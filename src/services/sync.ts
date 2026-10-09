import { diffTracks } from '../core/diff';
import type { Track } from '../core/types';
import type { Override, Repo } from './db';
import { AuthError, messageOf } from './errors';
import type { LibraryPlaylist } from './parse';

/** What sync needs from YouTube (a fake implements this in tests). */
export interface YtReader {
  libraryPlaylists(): Promise<LibraryPlaylist[]>;
  playlistTracks(id: string): Promise<Track[]>;
}

export interface SyncProgress {
  done: number;
  total: number;
  /** Titles being fetched right now. */
  active: string[];
}

export interface SyncResult {
  synced: number;
  skipped: { title: string; reason: string }[];
}

/** Run `fn` over `items` with at most `n` in flight. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  let failed: unknown;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (queue.length && failed === undefined) {
        try {
          await fn(queue.shift()!);
        } catch (e) {
          failed ??= e;
        }
      }
    }),
  );
  if (failed !== undefined) throw failed;
}

/** Snapshot one playlist. Returns {skipped: reason} when the read was not trusted (nothing is changed then). */
export async function syncPlaylist(repo: Repo, yt: YtReader, p: { id: string; title: string }, overrides?: Map<string, Override>, now = () => Date.now() / 1000): Promise<{ skipped?: string }> {
  await repo.ensurePlaylist(p.id, p.title);
  const tracks = await yt.playlistTracks(p.id);
  const stored = await repo.stored(p.id);
  if (!tracks.length && stored.some((s) => s.status === 'ok' || s.status === 'unavailable')) {
    return { skipped: 'YouTube returned no tracks; kept the saved copy' };
  }
  await repo.applyDiff(p.id, diffTracks(stored, tracks), now(), overrides ?? (await repo.overrides()));
  await repo.touchSynced(p.id, now());
  return {};
}

/**
 * Snapshot every non-hidden playlist. A playlist that cannot be read is skipped and reported (auto-generated
 * mixes have no readable contents); a sign-in problem aborts the whole run.
 * Safety: an empty answer for a playlist we already know is treated as a failed read, never as "everything was removed".
 */
export async function syncAll(repo: Repo, yt: YtReader, onProgress?: (p: SyncProgress) => void, concurrency = 3, now = () => Date.now() / 1000): Promise<SyncResult> {
  const hidden = await repo.hiddenIds();
  const todo = (await yt.libraryPlaylists()).filter((p) => !hidden.has(p.id));
  const overrides = await repo.overrides();
  const result: SyncResult = { synced: 0, skipped: [] };
  const active = new Set<string>();
  let done = 0;
  const report = () => onProgress?.({ done, total: todo.length, active: [...active] });
  report();
  await pool(todo, concurrency, async (p) => {
    active.add(p.title);
    report();
    try {
      const r = await syncPlaylist(repo, yt, p, overrides, now);
      if (r.skipped) result.skipped.push({ title: p.title, reason: r.skipped });
      else result.synced++;
    } catch (e) {
      if (e instanceof AuthError) throw e;
      result.skipped.push({ title: p.title, reason: messageOf(e) });
    } finally {
      active.delete(p.title);
      done++;
      report();
    }
  });
  return result;
}
