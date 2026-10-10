import { beforeEach, describe, expect, it, vi } from 'vitest';

const check = vi.fn();
vi.mock('@tauri-apps/plugin-updater', () => ({ check: (...a: unknown[]) => check(...a) }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: async () => undefined }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: async () => undefined }));

const { checkForUpdate } = await import('./updater');

describe('checkForUpdate', () => {
  beforeEach(() => {
    check.mockReset();
  });

  it('returns the update with its version and notes', async () => {
    check.mockResolvedValue({ version: '0.2.0', body: 'Notes', downloadAndInstall: async () => undefined });
    expect(await checkForUpdate()).toMatchObject({ version: '0.2.0', notes: 'Notes' });
  });

  it('returns null when up to date', async () => {
    check.mockResolvedValue(null);
    expect(await checkForUpdate()).toBeNull();
  });

  it('treats a release without a build for this system as "no update yet", not an error', async () => {
    check.mockRejectedValue(new Error('the platform `darwin-aarch64` was not found in the response `platforms` object'));
    expect(await checkForUpdate()).toBeNull();
  });

  it('still reports real failures (offline, bad signature, ...)', async () => {
    check.mockRejectedValue(new Error('error sending request for url'));
    await expect(checkForUpdate()).rejects.toThrow(/error sending request/u);
  });
});
