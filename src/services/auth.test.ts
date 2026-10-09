import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake keychain: the real one is behind Tauri commands.
const secrets = new Map<string, string>();
vi.mock('./tauri', () => ({
  secretGet: async (k: string) => secrets.get(k) ?? null,
  secretSet: async (k: string, v: string) => void secrets.set(k, v),
  secretDelete: async (k: string) => void secrets.delete(k),
  browserCookies: async () => '',
  browserProfiles: async () => [],
  defaultBrowser: async () => null,
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: async () => undefined }));
let accepted = true;
vi.mock('./yt', () => ({
  createClient: async () => ({}),
  Yt: class {
    async libraryPlaylists() {
      if (!accepted) throw new Error('401 unauthorized');
      return [];
    }
  },
}));

const { clearLogin, loadLogin, signInWithPastedCookie } = await import('./auth');
const cookie = (n: number) => `__Secure-3PAPISID=abc; ${'x'.repeat(n)}=1`;

describe('login storage', () => {
  beforeEach(() => {
    secrets.clear();
    accepted = true;
  });

  it('saves a verified login, restores it, and log out removes every stored piece', async () => {
    await signInWithPastedCookie(cookie(50));
    expect(await loadLogin()).toMatchObject({ source: 'pasted', cookie: expect.stringContaining('__Secure-3PAPISID=abc') });
    await clearLogin();
    expect(await loadLogin()).toBeNull();
    expect(secrets.size).toBe(0);
  });

  it('splits a big cookie into small chunks (Windows credentials are limited) and restores it exactly', async () => {
    const big = cookie(3000);
    await signInWithPastedCookie(big);
    const chunks = [...secrets].filter(([k]) => /^login\.\d+$/u.test(k)).map(([, v]) => v);
    expect(chunks.length).toBeGreaterThan(3);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(900);
    expect((await loadLogin())!.cookie).toBe(big);
  });

  it('never saves a login that YouTube rejects (so Reconnect cannot destroy a working login)', async () => {
    await signInWithPastedCookie(cookie(20));
    const before = new Map(secrets);
    accepted = false;
    await expect(signInWithPastedCookie(cookie(30))).rejects.toThrow(/rejected this login/u);
    expect(secrets).toEqual(before);
  });

  it('rejects text that is not a YouTube cookie', async () => {
    await expect(Promise.resolve().then(() => signInWithPastedCookie('hello'))).rejects.toThrow(/does not look like/u);
  });
});
