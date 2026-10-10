// Decides what a workflow run should release. Pure logic in plan(); the CLI part reads git tags and writes GitHub outputs.
//   push to a branch     -> next patch after the latest v* tag (first release = the committed version), Linux + Windows
//   manual run           -> chosen bump (patch|minor|major); macOS for minor/major or when asked; dry_run builds Linux only
//   push of a v* tag     -> exactly that version, all three systems
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SEMVER_TAG = /^v(\d+)\.(\d+)\.(\d+)$/u;

export function parseTag(tag) {
  const m = SEMVER_TAG.exec(tag);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const format = (v) => v.join('.');

/** Highest v<major>.<minor>.<patch> tag, compared numerically (v0.10.0 is newer than v0.9.0); other tags are ignored. */
export function latestVersion(tags) {
  return tags.map(parseTag).filter(Boolean).sort(compare).at(-1) ?? null;
}

export function bump(v, kind) {
  if (kind === 'major') return [v[0] + 1, 0, 0];
  if (kind === 'minor') return [v[0], v[1] + 1, 0];
  if (kind === 'patch') return [v[0], v[1], v[2] + 1];
  throw new Error(`unknown bump "${kind}" (use patch, minor or major)`);
}

const truthy = (x) => x === true || x === 'true';

const LINUX = { name: 'linux', os: 'ubuntu-22.04', args: '' };
const WINDOWS = { name: 'windows', os: 'windows-latest', args: '' };
const MACOS = { name: 'macos', os: 'macos-latest', args: '--target universal-apple-darwin' };

/**
 * @param {{ eventName: string, refType?: string, refName?: string, inputs?: Record<string, unknown>, tags: string[], baseVersion: string }} p
 * @returns {{ version: string, tag: string, previousTag: string | null, macos: boolean, dryRun: boolean, matrix: { name: string, os: string, args: string }[], kind: string }}
 */
export function plan({ eventName, refType = 'branch', refName = '', inputs = {}, tags, baseVersion }) {
  const latest = latestVersion(tags);
  const previousTag = latest ? `v${format(latest)}` : null;
  let version;
  let macos = false;
  let kind = 'patch';
  const dryRun = eventName === 'workflow_dispatch' && truthy(inputs.dry_run);

  if (eventName === 'push' && refType === 'tag') {
    const v = parseTag(refName);
    if (!v) throw new Error(`tag "${refName}" is not of the form vMAJOR.MINOR.PATCH`);
    version = format(v);
    macos = true; // a tag you push yourself is a full release
    kind = 'tag';
    const before = tags.map(parseTag).filter(Boolean).filter((x) => compare(x, v) < 0).sort(compare).at(-1);
    return finish(version, before ? `v${format(before)}` : null, macos, dryRun, kind);
  }

  const base = baseVersion.split('.').map(Number);
  if (base.length !== 3 || base.some(Number.isNaN)) throw new Error(`base version "${baseVersion}" is not MAJOR.MINOR.PATCH`);
  if (eventName === 'workflow_dispatch') {
    kind = String(inputs.bump || 'patch');
    macos = kind !== 'patch' || truthy(inputs.macos);
  }
  if (!latest && kind === 'patch') version = format(base); // very first release: the committed version
  else version = format(bump(latest ?? base, kind));
  return finish(version, previousTag, macos, dryRun, kind);
}

function finish(version, previousTag, macos, dryRun, kind) {
  const matrix = dryRun ? [LINUX] : [LINUX, WINDOWS, ...(macos ? [MACOS] : [])];
  return { version, tag: `v${version}`, previousTag, macos: macos && !dryRun, dryRun, matrix, kind };
}

// ---- CLI ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const baseVersion = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version;
  const p = plan({
    eventName: env.EVENT_NAME ?? 'push',
    refType: env.REF_TYPE,
    refName: env.REF_NAME,
    inputs: { bump: env.INPUT_BUMP, macos: env.INPUT_MACOS, dry_run: env.INPUT_DRY_RUN },
    tags,
    baseVersion,
  });
  console.log(JSON.stringify(p, null, 2));
  if (env.GITHUB_OUTPUT) {
    const out = { version: p.version, tag: p.tag, previous_tag: p.previousTag ?? '', macos: String(p.macos), dry_run: String(p.dryRun), matrix: JSON.stringify(p.matrix) };
    appendFileSync(env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}\n`).join(''));
  }
}
