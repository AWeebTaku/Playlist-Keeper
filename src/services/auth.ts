/**
 * Sign-in = the YouTube cookies of a browser that is already signed in (or a pasted cookie). Google's device-code
 * login was tried and dropped: YouTube Music answers 400 to its tokens. The login lives in the OS keychain;
 * Windows credentials are limited to ~1.2k characters, so values are chunked.
 */
import { openUrl } from '@tauri-apps/plugin-opener';
import { AuthError, messageOf } from './errors';
import { browserCookies, browserProfiles, defaultBrowser, secretDelete, secretGet, secretSet } from './tauri';
import { createClient, Yt } from './yt';

export interface Login {
  cookie: string;
  /** Where it came from: a browser name or 'pasted'. */
  source: string;
}

const KEY = 'login';
const CHUNK = 900;

async function putSecret(key: string, value: string): Promise<void> {
  const parts = value.match(new RegExp(`.{1,${CHUNK}}`, 'gsu')) ?? [''];
  for (const [i, p] of parts.entries()) await secretSet(`${key}.${i}`, p);
  await secretSet(`${key}.n`, String(parts.length));
}

async function getSecret(key: string): Promise<string | null> {
  const n = Number(await secretGet(`${key}.n`));
  if (!n) return null;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push((await secretGet(`${key}.${i}`)) ?? '');
  return parts.join('');
}

async function dropSecret(key: string): Promise<void> {
  const n = Number(await secretGet(`${key}.n`)) || 0;
  for (let i = 0; i < n; i++) await secretDelete(`${key}.${i}`);
  await secretDelete(`${key}.n`);
}

export async function loadLogin(): Promise<Login | null> {
  try {
    const raw = await getSecret(KEY);
    const l = raw ? (JSON.parse(raw) as Partial<Login>) : null;
    return l?.cookie ? { cookie: l.cookie, source: l.source ?? 'browser' } : null;
  } catch {
    return null; // an unreadable keychain or corrupt value just means "not signed in"
  }
}

const saveLogin = (l: Login) => putSecret(KEY, JSON.stringify(l));
export const clearLogin = () => dropSecret(KEY);

export async function clientFor(login: Login): Promise<Yt> {
  return new Yt(await createClient(login.cookie));
}

/** Use the login for real (read the library) before it is saved: a wrong or expired login is rejected here. */
async function verifyAndSave(login: Login): Promise<Yt> {
  const client = await clientFor(login);
  try {
    await client.libraryPlaylists();
  } catch (e) {
    throw e instanceof AuthError ? e : new AuthError(`YouTube rejected this login: ${messageOf(e)}`);
  }
  await saveLogin(login);
  return client;
}

export interface BrowserChoice {
  /** Browser name understood by the Rust shell (firefox, chrome, ...). */
  browser: string;
  isDefault: boolean;
}

const BROWSERS = ['firefox', 'chrome', 'edge', 'brave', 'chromium', 'vivaldi', 'opera', 'librewolf'] as const;

export async function browserChoices(): Promise<BrowserChoice[]> {
  const def = await defaultBrowser().catch(() => null);
  const list = [...BROWSERS].sort((a, b) => Number(b === def) - Number(a === def));
  return list.map((browser) => ({ browser, isDefault: browser === def }));
}

/** Signed-in Firefox profiles (empty for other browsers, which use their default profile). */
export const profilesOf = (browser: string) => browserProfiles(browser).catch(() => []);

export async function signInWithBrowserCookies(browser: string, profile?: string): Promise<Yt> {
  let cookie: string;
  try {
    cookie = await browserCookies(browser, profile);
  } catch (e) {
    throw new AuthError(messageOf(e));
  }
  return verifyAndSave({ cookie, source: browser });
}

/** Last resort (e.g. Chrome on Windows 127+, which blocks other apps from reading its cookies): a pasted cookie string. */
export function signInWithPastedCookie(text: string): Promise<Yt> {
  const cookie = text.replace(/^\s*cookie:\s*/iu, '').trim();
  if (!/__Secure-3PAPISID=/u.test(cookie)) throw new AuthError('That does not look like a YouTube cookie (it has no __Secure-3PAPISID).');
  return verifyAndSave({ cookie, source: 'pasted' });
}

/** Open YouTube Music in the default browser so the user can sign in there first. */
export const openYoutubeMusic = () => openUrl('https://music.youtube.com');
