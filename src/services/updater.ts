/** Auto-update: checks the release feed, and installs only when the user asks. Update packages are verified with the key in tauri.conf.json. */
import { openUrl } from '@tauri-apps/plugin-opener';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import type { UpdateSupport } from './tauri';

export interface Available {
  version: string;
  notes: string;
  install(onProgress?: (pct: number | null) => void): Promise<void>;
}

/** A release can lack a system (macOS is only built for minor and major releases): that means "no update for you yet", not a failure. */
const NO_BUILD_FOR_THIS_SYSTEM = /platform.*not found|not found.*platform/iu;

/** The newer release, or null when up to date (or when the newest release has no build for this system). Throws when the feed cannot be reached. */
export async function checkForUpdate(): Promise<Available | null> {
  let update;
  try {
    update = await check();
  } catch (e) {
    if (NO_BUILD_FOR_THIS_SYSTEM.test(e instanceof Error ? e.message : String(e))) return null;
    throw e;
  }
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body ?? '',
    async install(onProgress) {
      let total = 0;
      let got = 0;
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') total = e.data.contentLength ?? 0;
        else if (e.event === 'Progress') {
          got += e.data.chunkLength;
          onProgress?.(total ? Math.round((got / total) * 100) : null);
        }
      });
      await relaunch();
    },
  };
}

/** One sentence on how an update is installed on this system. */
export function updateHow(u: UpdateSupport): string {
  if (!u.supported) return `${u.reason ?? 'This install is managed by your package manager'}. Download the new package from GitHub and install it with your package manager (on Arch: sudo pacman -U).`;
  if (u.os === 'windows') return 'On Windows the app downloads the installer, runs it and restarts.';
  if (u.os === 'macos') return 'On macOS the app downloads the new version, replaces itself and restarts.';
  if (u.bundle === 'appimage') return 'This AppImage downloads the new version, replaces itself and restarts.';
  if (u.bundle === 'deb') return 'On Debian-based systems the app installs the new .deb with dpkg (it asks for your password) and restarts.';
  if (u.bundle === 'rpm') return 'On RPM-based systems the app installs the new .rpm (it asks for your password) and restarts.';
  return 'The app downloads the new version and restarts.';
}

export const openReleasesPage = (url: string) => openUrl(url);
