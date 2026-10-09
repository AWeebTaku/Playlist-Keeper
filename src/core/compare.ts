import { bucketKey, namesOverlap, songKey } from './sanitize';

export interface Row {
  playlistId: string;
  videoId: string;
  title: string | null;
  artists: string;
}

export type How = 'same video' | 'same song';

interface KeyEntry {
  names: Set<string>;
  playlistId: string;
}

export interface Index {
  byVideo: Map<string, Set<string>>;
  byKey: Map<string, KeyEntry[]>;
}

const memo = new Map<string, ReturnType<typeof songKey>>();
function keyOf(title: string, artists: string) {
  const id = `${title}\u0000${artists}`;
  let k = memo.get(id);
  if (!k) memo.set(id, (k = songKey(title, artists)));
  return k;
}

export function buildIndex(rows: Iterable<Row>): Index {
  const byVideo = new Map<string, Set<string>>();
  const byKey = new Map<string, KeyEntry[]>();
  for (const r of rows) {
    (byVideo.get(r.videoId) ?? byVideo.set(r.videoId, new Set()).get(r.videoId)!).add(r.playlistId);
    if (!r.title) continue;
    const k = keyOf(r.title, r.artists);
    if (!k.key) continue;
    const bk = bucketKey(k.key, k.tags);
    (byKey.get(bk) ?? byKey.set(bk, []).get(bk)!).push({ names: k.names, playlistId: r.playlistId });
  }
  return { byVideo, byKey };
}

/** Playlists in the index that already hold this track: same video, or same song and version. */
export function whereIn(item: Pick<Row, 'videoId' | 'title' | 'artists'>, idx: Index): Map<string, How> {
  const found = new Map<string, How>();
  for (const p of idx.byVideo.get(item.videoId) ?? []) found.set(p, 'same video');
  if (item.title) {
    const k = keyOf(item.title, item.artists);
    for (const e of idx.byKey.get(bucketKey(k.key, k.tags)) ?? []) {
      if (!found.has(e.playlistId) && (!k.names.size || !e.names.size || namesOverlap(k.names, e.names))) found.set(e.playlistId, 'same song');
    }
  }
  return found;
}

/** For each track of `playlistId`: the other playlists (from `others`) that already contain it. */
export function whereElse(items: Row[], others: Row[]): Map<string, { playlistId: string; how: How }[]> {
  const idx = buildIndex(others);
  const out = new Map<string, { playlistId: string; how: How }[]>();
  for (const it of items) {
    const w = whereIn(it, idx);
    if (w.size) out.set(it.videoId, [...w].map(([playlistId, how]) => ({ playlistId, how })));
  }
  return out;
}

/** A vs B: only in A, in both (by video or song+version), only in B. */
export function compare<T extends Row>(a: T[], b: T[]): { onlyA: T[]; both: T[]; onlyB: T[] } {
  const ia = buildIndex(a);
  const ib = buildIndex(b);
  return {
    onlyA: a.filter((x) => !whereIn(x, ib).size),
    both: a.filter((x) => whereIn(x, ib).size),
    onlyB: b.filter((x) => !whereIn(x, ia).size),
  };
}
