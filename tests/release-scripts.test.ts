import { describe, expect, it } from 'vitest';
import { makeLatest } from '../scripts/make-latest-json.mjs';
import { bump, latestVersion, parseTag, plan } from '../scripts/release-plan.mjs';

const base = '0.1.0';
const push = (tags: string[], extra = {}) => plan({ eventName: 'push', refType: 'branch', refName: 'master', tags, baseVersion: base, ...extra });

describe('release plan', () => {
  it('first release is the committed version; later pushes bump the patch of the newest tag', () => {
    expect(push([]).version).toBe('0.1.0');
    expect(push(['v0.1.0']).version).toBe('0.1.1');
    expect(push(['v0.1.0', 'v0.1.1']).tag).toBe('v0.1.2');
  });

  it('compares versions numerically and ignores other tags', () => {
    expect(latestVersion(['v0.9.0', 'v0.10.0', 'v0.2.5', 'nightly', 'v1.0', 'vX.1.2'])).toEqual([0, 10, 0]);
    expect(push(['v0.9.0', 'v0.10.0']).version).toBe('0.10.1');
    expect(parseTag('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseTag('1.2.3')).toBeNull();
    expect(bump([1, 2, 3], 'minor')).toEqual([1, 3, 0]);
    expect(bump([1, 2, 3], 'major')).toEqual([2, 0, 0]);
    expect(() => bump([1, 2, 3], 'huge')).toThrow(/unknown bump/u);
  });

  it('pushes build Linux and Windows only; macOS is for minor, major, tags and explicit requests', () => {
    expect(push(['v0.1.0']).matrix.map((m) => m.name)).toEqual(['linux', 'windows']);
    expect(push(['v0.1.0']).macos).toBe(false);
    const dispatch = (inputs: Record<string, unknown>) => plan({ eventName: 'workflow_dispatch', inputs, tags: ['v0.1.4'], baseVersion: base });
    expect(dispatch({ bump: 'patch' })).toMatchObject({ version: '0.1.5', macos: false });
    expect(dispatch({ bump: 'patch', macos: 'true' })).toMatchObject({ version: '0.1.5', macos: true });
    const minor = dispatch({ bump: 'minor' });
    expect(minor).toMatchObject({ version: '0.2.0', macos: true });
    expect(minor.matrix.map((m) => m.name)).toEqual(['linux', 'windows', 'macos']);
    expect(minor.matrix.at(-1)).toMatchObject({ os: 'macos-latest', args: '--target universal-apple-darwin' });
    expect(dispatch({ bump: 'major' }).version).toBe('1.0.0');
  });

  it('a pushed tag is released exactly as named, on all three systems', () => {
    const p = plan({ eventName: 'push', refType: 'tag', refName: 'v0.3.0', tags: ['v0.1.0', 'v0.2.0', 'v0.3.0'], baseVersion: base });
    expect(p).toMatchObject({ version: '0.3.0', tag: 'v0.3.0', macos: true, previousTag: 'v0.2.0', kind: 'tag' });
    expect(p.matrix).toHaveLength(3);
    expect(() => plan({ eventName: 'push', refType: 'tag', refName: 'v1', tags: [], baseVersion: base })).toThrow(/not of the form/u);
  });

  it('a dry run builds Linux only and never plans macOS', () => {
    const p = plan({ eventName: 'workflow_dispatch', inputs: { bump: 'minor', dry_run: 'true' }, tags: ['v0.1.0'], baseVersion: base });
    expect(p).toMatchObject({ dryRun: true, macos: false });
    expect(p.matrix.map((m) => m.name)).toEqual(['linux']);
  });

  it('the version sequence over several runs is 0.1.0, 0.1.1, 0.2.0, 0.2.1', () => {
    const tags: string[] = [];
    const run = (e: Parameters<typeof plan>[0]) => {
      const p = plan({ ...e, tags: [...tags], baseVersion: base });
      tags.push(p.tag);
      return p.version;
    };
    const seq = [
      run({ eventName: 'push', refType: 'branch', refName: 'master', tags: [], baseVersion: base }),
      run({ eventName: 'push', refType: 'branch', refName: 'master', tags: [], baseVersion: base }),
      run({ eventName: 'workflow_dispatch', inputs: { bump: 'minor' }, tags: [], baseVersion: base }),
      run({ eventName: 'push', refType: 'branch', refName: 'master', tags: [], baseVersion: base }),
    ];
    expect(seq).toEqual(['0.1.0', '0.1.1', '0.2.0', '0.2.1']);
  });
});

const sig = (n: string) => `SIG-${n}`;
const LINUX = ['Playlist-Keeper_0.2.0_amd64.AppImage', 'Playlist-Keeper_0.2.0_amd64.deb', 'Playlist-Keeper-0.2.0-1.x86_64.rpm'];
const WINDOWS = ['Playlist-Keeper_0.2.0_x64-setup.exe', 'Playlist-Keeper_0.2.0_x64_en-US.msi'];
const MAC = ['Playlist-Keeper_universal.app.tar.gz'];
const feed = (names: string[], skipSig: string[] = []) =>
  makeLatest({ tag: 'v0.2.0', repo: 'me/app', notes: 'N', pubDate: 'D', names: [...names, 'Playlist-Keeper_0.2.0_universal.dmg', 'SHA256SUMS.txt'], sigs: Object.fromEntries(names.filter((n) => !skipSig.includes(n)).map((n) => [n, sig(n)])) });

describe('update feed', () => {
  it('has a key for every installer type, with the signature and a release-tag url', () => {
    const f = feed([...LINUX, ...WINDOWS, ...MAC]);
    expect(f).toMatchObject({ version: '0.2.0', notes: 'N', pub_date: 'D' });
    expect(Object.keys(f.platforms).sort()).toEqual(
      ['darwin-aarch64', 'darwin-x86_64', 'linux-x86_64', 'linux-x86_64-appimage', 'linux-x86_64-deb', 'linux-x86_64-rpm', 'windows-x86_64', 'windows-x86_64-msi', 'windows-x86_64-nsis'],
    );
    expect(f.platforms['linux-x86_64-deb']).toEqual({ signature: sig(LINUX[1]!), url: `https://github.com/me/app/releases/download/v0.2.0/${LINUX[1]}` });
    expect(f.platforms['linux-x86_64']!.url).toMatch(/\.AppImage$/u); // the fallback is the AppImage
    expect(f.platforms['windows-x86_64']!.url).toMatch(/-setup\.exe$/u);
    expect(f.platforms['darwin-aarch64']).toEqual(f.platforms['darwin-x86_64']); // one universal archive for both CPUs
  });

  it('a release without macOS simply has no darwin entries', () => {
    const f = feed([...LINUX, ...WINDOWS]);
    expect(Object.keys(f.platforms).some((k) => k.startsWith('darwin'))).toBe(false);
    expect(Object.keys(f.platforms)).toContain('windows-x86_64-nsis');
  });

  it('refuses to build a feed from an unsigned or incomplete release', () => {
    expect(() => feed([...LINUX, ...WINDOWS], [LINUX[0]!])).toThrow(/no signature/u);
    expect(() => feed([LINUX[0]!, LINUX[1]!, ...WINDOWS])).toThrow(/linux build is incomplete: missing rpm/u);
    expect(() => feed(WINDOWS.slice(0, 1))).toThrow(/windows build is incomplete: missing msi/u);
    expect(() => makeLatest({ tag: 'v0.2.0', repo: 'me/app', names: ['README.md'], sigs: {} })).toThrow(/no installers/u);
    expect(() => makeLatest({ tag: '0.2.0', repo: 'me/app', names: LINUX, sigs: {} })).toThrow(/bad tag/u);
  });
});
