/** Composition root: opens the database, holds the signed-in YouTube client, exposes what the UI calls. */
import { Repo } from './db';
import { openAppDatabase } from './sql';
import { clearLogin, clientFor, loadLogin } from './auth';
import { syncAll, type SyncProgress, type SyncResult } from './sync';
import type { Yt } from './yt';

let repo: Repo | null = null;
let yt: Yt | null = null;

export async function openRepo(): Promise<Repo> {
  if (!repo) {
    repo = new Repo(await openAppDatabase());
  }
  return repo;
}

/** Restore the saved login, if any. */
export async function restoreSession(): Promise<boolean> {
  const login = await loadLogin();
  if (!login) return false;
  yt = await clientFor(login);
  return true;
}

export function setClient(client: Yt | null): void {
  yt = client;
}

export async function signOut(): Promise<void> {
  yt = null;
  await clearLogin();
}

export function client(): Yt {
  if (!yt) throw new Error('Not signed in');
  return yt;
}

export async function runSync(onProgress: (p: SyncProgress) => void): Promise<SyncResult> {
  return syncAll(await openRepo(), client(), onProgress);
}
