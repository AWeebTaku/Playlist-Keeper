// Builds the auto-update feed (latest.json) from the installers and signatures of a release.
//   node scripts/make-latest-json.mjs --tag v0.2.0 --repo owner/name --dir assets [--notes-file notes.md] --out latest.json
// The updater looks up "{os}-{arch}-{installer}" first, then "{os}-{arch}", so every installer type gets its own key.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Which file is which. Names are the ones GitHub shows (spaces become dots, so match on the endings). */
const KINDS = [
  { group: 'linux', id: 'appimage', re: /\.AppImage$/iu, keys: ['linux-x86_64-appimage', 'linux-x86_64'] },
  { group: 'linux', id: 'deb', re: /\.deb$/iu, keys: ['linux-x86_64-deb'] },
  { group: 'linux', id: 'rpm', re: /\.rpm$/iu, keys: ['linux-x86_64-rpm'] },
  { group: 'windows', id: 'nsis', re: /-setup\.exe$/iu, keys: ['windows-x86_64-nsis', 'windows-x86_64'] },
  { group: 'windows', id: 'msi', re: /\.msi$/iu, keys: ['windows-x86_64-msi'] },
  { group: 'macos', id: 'app', re: /\.app\.tar\.gz$/iu, keys: ['darwin-aarch64', 'darwin-x86_64'] }, // universal build serves both CPUs
];

/**
 * @param {{ tag: string, repo: string, notes?: string, pubDate?: string, names: string[], sigs: Record<string, string> }} p
 * @returns {{ version: string, notes: string, pub_date: string, platforms: Record<string, { signature: string, url: string }> }}
 *   names: every file name of the release; sigs: file name -> signature text (contents of "<file>.sig")
 */
export function makeLatest({ tag, repo, notes = '', pubDate = new Date().toISOString(), names, sigs }) {
  if (!/^v\d+\.\d+\.\d+$/u.test(tag)) throw new Error(`bad tag "${tag}"`);
  /** @type {Record<string, { signature: string, url: string }>} */
  const platforms = {};
  const seen = new Map(); // group -> installer ids found
  for (const name of names) {
    const kind = KINDS.find((k) => k.re.test(name));
    if (!kind) continue;
    const signature = sigs[name]?.trim();
    if (!signature) throw new Error(`${name} has no signature file (${name}.sig); refusing to publish an update feed without it`);
    const url = `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;
    for (const key of kind.keys) platforms[key] = { signature, url };
    seen.set(kind.group, [...(seen.get(kind.group) ?? []), kind.id]);
  }
  if (!seen.size) throw new Error('no installers found: nothing to put in the update feed');
  for (const [group, ids] of seen) {
    const want = KINDS.filter((k) => k.group === group).map((k) => k.id);
    const missing = want.filter((id) => !ids.includes(id));
    if (missing.length) throw new Error(`${group} build is incomplete: missing ${missing.join(', ')}`);
  }
  return { version: tag.slice(1), notes, pub_date: pubDate, platforms };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n) => process.argv[process.argv.indexOf(`--${n}`) + 1];
  const dir = arg('dir');
  const names = readdirSync(dir).filter((f) => !f.endsWith('.sig'));
  const sigs = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.sig')).map((f) => [f.slice(0, -4), readFileSync(join(dir, f), 'utf8')]));
  const notes = process.argv.includes('--notes-file') ? readFileSync(arg('notes-file'), 'utf8') : '';
  const feed = makeLatest({ tag: arg('tag'), repo: arg('repo'), notes, names, sigs });
  writeFileSync(arg('out'), JSON.stringify(feed, null, 2) + '\n');
  console.log(`latest.json: version ${feed.version}, platforms: ${Object.keys(feed.platforms).join(', ')}`);
}
