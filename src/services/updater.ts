/** Auto-update: checks the release feed, and installs only when the user asks. Update packages are verified with the key in tauri.conf.json. */
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

export interface Available {
  version: string;
  notes: string;
  install(onProgress?: (pct: number | null) => void): Promise<void>;
}

/** The newer release, or null when up to date. Throws when the feed cannot be reached. */
export async function checkForUpdate(): Promise<Available | null> {
  const update = await check();
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
