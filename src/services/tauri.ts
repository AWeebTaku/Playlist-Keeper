/** Typed wrappers for the commands the Rust shell exposes (see src-tauri/src/lib.rs). */
import { invoke } from '@tauri-apps/api/core';

export interface BrowserProfile {
  id: string;
  label: string;
  modified: number;
}

export const secretGet = (key: string) => invoke<string | null>('secret_get', { key });
export const secretSet = (key: string, value: string) => invoke<void>('secret_set', { key, value });
export const secretDelete = (key: string) => invoke<void>('secret_delete', { key });
export const browserProfiles = (browser: string) => invoke<BrowserProfile[]>('browser_profiles', { browser });
export const browserCookies = (browser: string, profile?: string) => invoke<string>('browser_cookies', { browser, profile: profile ?? null });
export const defaultBrowser = () => invoke<string | null>('default_browser');
