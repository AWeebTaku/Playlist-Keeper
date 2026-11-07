/** Combine playlists: read the chosen playlists fresh, then create the new playlist(s) on YouTube and fill them. */
import { PLAYLIST_LIMIT, splitParts, partTitles, type PlanTrack, type Source } from '../core/combine';
import type { Repo } from './db';
import { syncPlaylist } from './sync';
import type { YtClient } from './actions';

/** Songs sent to YouTube per request. */
export const BATCH = 100;

/** Refresh each chosen playlist (so greyed-out entries and their youtube.com status are current), then read the saved copies. */
export async function loadSources(repo: Repo, yt: YtClient, picked: { id: string; title: string }[], onProgress?: (done: number, total: number) => void): Promise<Source[]> {
  const out: Source[] = [];
  for (const [n, p] of picked.entries()) {
    onProgress?.(n, picked.length);
    await syncPlaylist(repo, yt, p); // a skipped (unreadable) playlist keeps its saved copy
    out.push({ id: p.id, title: p.title, items: await repo.items(p.id) });
  }
  onProgress?.(picked.length, picked.length);
  return out;
}

interface CombinePart {
  title: string;
  tracks: PlanTrack[];
  /** Playlist id once it exists on YouTube. */
  id: string | null;
  /** How many of `tracks` are already in it. A failed run can be started again and carries on from here. */
  added: number;
}

export interface CombineRun {
  parts: CombinePart[];
}

export const newRun = (tracks: PlanTrack[], titles: string[], limit = PLAYLIST_LIMIT): CombineRun => ({
  parts: splitParts(tracks, limit).map((t, i) => ({ title: titles[i] ?? partTitles('Combined', i + 1)[i]!, tracks: t, id: null, added: 0 })),
});

/**
 * Add songs to an existing playlist in batches, then refresh its saved copy. `onProgress` gets (songs added so far, total).
 * Stops at the first failure; what was added stays (nothing is added twice if the caller retries with the rest).
 */
export async function addSongs(repo: Repo, yt: YtClient, playlist: { id: string; title: string }, tracks: PlanTrack[], onProgress?: (done: number, total: number) => void): Promise<number> {
  let added = 0;
  try {
    while (added < tracks.length) {
      const next = tracks.slice(added, added + BATCH);
      await yt.addVideos(playlist.id, next.map((t) => t.videoId));
      added += next.length;
      onProgress?.(added, tracks.length);
    }
  } finally {
    if (added) await syncPlaylist(repo, yt, playlist);
  }
  return added;
}

export interface PartResult {
  title: string;
  id: string;
  expected: number;
  /** Songs found in the playlist when it was read back (YouTube can take a moment to show them all). */
  found: number;
}

/**
 * Create each playlist (private) and add its songs in batches. Safe to call again after an error: finished work is kept
 * in `run`, so nothing is created or added twice.
 */
export async function runCombine(repo: Repo, yt: YtClient, run: CombineRun, onProgress?: (done: number, total: number) => void): Promise<PartResult[]> {
  const total = run.parts.reduce((n, p) => n + p.tracks.length, 0);
  const done = () => run.parts.reduce((n, p) => n + p.added, 0);
  onProgress?.(done(), total);
  for (const part of run.parts) {
    if (!part.id) {
      const first = part.tracks.slice(0, BATCH);
      part.id = await yt.createPlaylist(part.title, first.map((t) => t.videoId));
      part.added = first.length;
      onProgress?.(done(), total);
    }
    while (part.added < part.tracks.length) {
      const next = part.tracks.slice(part.added, part.added + BATCH);
      await yt.addVideos(part.id, next.map((t) => t.videoId));
      part.added += next.length;
      onProgress?.(done(), total);
    }
  }
  const results: PartResult[] = [];
  for (const part of run.parts) {
    await syncPlaylist(repo, yt, { id: part.id!, title: part.title });
    const found = (await repo.items(part.id!)).filter((i) => i.status === 'ok' || i.status === 'unavailable').length;
    results.push({ title: part.title, id: part.id!, expected: part.tracks.length, found });
  }
  return results;
}
