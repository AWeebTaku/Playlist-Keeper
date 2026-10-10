/** Typed wrappers for the commands the Rust shell exposes (see src-tauri/src/lib.rs). */
import { invoke } from '@tauri-apps/api/core';

export interface BrowserProfile {
  id: string;
  label: string;
  modified: number;
}

export interface UpdateSupport {
  supported: boolean;
  /** Why the app cannot update itself (installed from a package that a package manager owns), if it cannot. */
  reason: string | null;
  /** The releases page of the project, when known. */
  releasesUrl: string | null;
  /** "linux", "windows" or "macos", and the package type (appimage, deb, rpm, nsis, msi, app) when known. */
  os: string;
  bundle: string | null;
}

export const secretGet = (key: string) => invoke<string | null>('secret_get', { key });
export const secretSet = (key: string, value: string) => invoke<void>('secret_set', { key, value });
export const secretDelete = (key: string) => invoke<void>('secret_delete', { key });
export const browserProfiles = (browser: string) => invoke<BrowserProfile[]>('browser_profiles', { browser });
export const browserCookies = (browser: string, profile?: string) => invoke<string>('browser_cookies', { browser, profile: profile ?? null });
export const defaultBrowser = () => invoke<string | null>('default_browser');
export const updateSupport = () => invoke<UpdateSupport>('update_support');
