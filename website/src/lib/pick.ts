/** Pure helpers for the download buttons: which system the visitor is on, and which release file is which. */

export type Os = 'windows' | 'macos' | 'linux';
export interface Asset {
  name: string;
  browser_download_url: string;
}
/** Keys used in the page as data-asset="..." */
export type AssetKey = 'windows-exe' | 'windows-msi' | 'macos-dmg' | 'linux-deb' | 'linux-rpm' | 'linux-appimage' | 'linux-arch' | 'sums';

export function detectOs(userAgent: string, platform = ''): Os | null {
  const s = `${platform} ${userAgent}`.toLowerCase();
  if (/android|iphone|ipad|ipod/u.test(s)) return null; // desktop app only
  if (/win/u.test(s) && !/darwin/u.test(s)) return 'windows';
  if (/mac/u.test(s)) return 'macos';
  if (/linux|x11|cros/u.test(s)) return 'linux';
  return null;
}

const RULES: [AssetKey, RegExp][] = [
  ['windows-exe', /-setup\.exe$/iu],
  ['windows-msi', /\.msi$/iu],
  ['macos-dmg', /\.dmg$/iu],
  ['linux-deb', /\.deb$/iu],
  ['linux-rpm', /\.rpm$/iu],
  ['linux-appimage', /\.appimage$/iu],
  ['linux-arch', /\.pkg\.tar\.zst$/iu],
  ['sums', /^SHA256SUMS/iu],
];

/** Map each known file kind to its download URL. Kinds missing from the release are simply absent. */
export function pickAssets(assets: Asset[]): Partial<Record<AssetKey, string>> {
  const out: Partial<Record<AssetKey, string>> = {};
  for (const [key, re] of RULES) {
    const hit = assets.find((a) => re.test(a.name));
    if (hit) out[key] = hit.browser_download_url;
  }
  return out;
}

/** The main installer for a system. Linux has no single answer, so it falls back to the AppImage. */
export const primaryKey = (os: Os): AssetKey => (os === 'windows' ? 'windows-exe' : os === 'macos' ? 'macos-dmg' : 'linux-appimage');
