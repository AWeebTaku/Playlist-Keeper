/** Two playlists laid next to each other, row by row, with a verdict for each position. Pure. */
import { bucketKey, namesOverlap, songKey } from './sanitize';

export interface Entry {
  videoId: string;
  title: string | null;
  artists: string;
}

export type Verdict = 'same-video' | 'same-song' | 'different' | 'only-a' | 'only-b';

export interface Pair<T extends Entry> {
  /** 1-based position shown to the user. */
  index: number;
  a: T | null;
  b: T | null;
  verdict: Verdict;
}

/** The same video, or the same song in the same version by overlapping artists (as the rest of the app decides it). */
export function sameness(x: Entry, y: Entry): 'same-video' | 'same-song' | null {
  if (x.videoId === y.videoId) return 'same-video';
  if (!x.title || !y.title) return null;
  const kx = songKey(x.title, x.artists);
  const ky = songKey(y.title, y.artists);
  if (!kx.key || bucketKey(kx.key, kx.tags) !== bucketKey(ky.key, ky.tags)) return null;
  return !kx.names.size || !ky.names.size || namesOverlap(kx.names, ky.names) ? 'same-song' : null;
}

/** Pair the n-th song of A with the n-th song of B. The longer list's extra songs are "only in" that list. */
export function alignByPosition<T extends Entry>(a: T[], b: T[]): Pair<T>[] {
  const out: Pair<T>[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? null;
    const y = b[i] ?? null;
    out.push({ index: i + 1, a: x, b: y, verdict: x && y ? (sameness(x, y) ?? 'different') : x ? 'only-a' : 'only-b' });
  }
  return out;
}

/**
 * Finds where a song sits in a list, anywhere in it (not just at the same position). Build it once per list, then ask for
 * as many songs as needed. A match is the same video or the same song in the same version by overlapping artists.
 */
export function locator<T extends Entry>(list: T[]): (song: Entry) => { found: T; kind: 'same-video' | 'same-song' } | null {
  const byVideo: Record<string, T> = {};
  const byKey: Record<string, { names: Set<string>; item: T }[]> = {};
  for (const item of list) {
    byVideo[item.videoId] ??= item;
    if (!item.title) continue;
    const k = songKey(item.title, item.artists);
    if (k.key) (byKey[bucketKey(k.key, k.tags)] ??= []).push({ names: k.names, item });
  }
  return (song) => {
    const same = byVideo[song.videoId];
    if (same) return { found: same, kind: 'same-video' };
    if (!song.title) return null;
    const k = songKey(song.title, song.artists);
    if (!k.key) return null;
    const hit = byKey[bucketKey(k.key, k.tags)]?.find((e) => !k.names.size || !e.names.size || namesOverlap(k.names, e.names));
    return hit ? { found: hit.item, kind: 'same-song' } : null;
  };
}

export function summarize(pairs: Pair<Entry>[]) {
  const n = (...v: Verdict[]) => pairs.filter((p) => v.includes(p.verdict)).length;
  return { same: n('same-video', 'same-song'), different: n('different'), onlyA: n('only-a'), onlyB: n('only-b') };
}
