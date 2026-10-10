import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectOs, pickAssets, primaryKey } from '../src/lib/pick.ts';

const names = [
  'latest.json',
  'playlist-keeper-0.2.0-1-x86_64.pkg.tar.zst',
  'playlist-keeper-0.2.0-1.x86_64.rpm',
  'Playlist-Keeper.app.tar.gz',
  'playlist-keeper_0.2.0_amd64.AppImage',
  'playlist-keeper_0.2.0_amd64.deb',
  'Playlist-Keeper_0.2.0_universal.dmg',
  'Playlist-Keeper_0.2.0_x64-setup.exe',
  'Playlist-Keeper_0.2.0_x64_en-US.msi',
  'SHA256SUMS.txt',
].map((name) => ({ name, browser_download_url: `https://x/${name}` }));

test('every file kind is found in the real v0.2.0 asset list', () => {
  const p = pickAssets(names);
  assert.equal(p['windows-exe'], 'https://x/Playlist-Keeper_0.2.0_x64-setup.exe');
  assert.equal(p['windows-msi'], 'https://x/Playlist-Keeper_0.2.0_x64_en-US.msi');
  assert.equal(p['macos-dmg'], 'https://x/Playlist-Keeper_0.2.0_universal.dmg');
  assert.equal(p['linux-deb'], 'https://x/playlist-keeper_0.2.0_amd64.deb');
  assert.equal(p['linux-rpm'], 'https://x/playlist-keeper-0.2.0-1.x86_64.rpm');
  assert.equal(p['linux-appimage'], 'https://x/playlist-keeper_0.2.0_amd64.AppImage');
  assert.equal(p['linux-arch'], 'https://x/playlist-keeper-0.2.0-1-x86_64.pkg.tar.zst');
  assert.equal(p.sums, 'https://x/SHA256SUMS.txt');
});

test('kinds that a release lacks are absent, never wrong', () => {
  const p = pickAssets(names.filter((n) => !n.name.endsWith('.dmg')));
  assert.equal(p['macos-dmg'], undefined);
  assert.deepEqual(pickAssets([]), {});
});

test('system detection', () => {
  assert.equal(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', 'Windows'), 'windows');
  assert.equal(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'macOS'), 'macos');
  assert.equal(detectOs('Mozilla/5.0 (X11; Linux x86_64) Firefox/131', ''), 'linux');
  assert.equal(detectOs('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', ''), null);
  assert.equal(detectOs('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', ''), null);
  assert.equal(detectOs('', ''), null);
});

test('main installer per system', () => {
  assert.equal(primaryKey('windows'), 'windows-exe');
  assert.equal(primaryKey('macos'), 'macos-dmg');
  assert.equal(primaryKey('linux'), 'linux-appimage');
});
