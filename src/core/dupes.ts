import { bucketKey, clean, namesOverlap } from './sanitize';
import type { Track } from './types';

type Tier = 'exact' | 'likely' | 'possible';

interface DupItem {
  videoId: string;
  setVideoId: string | null;
  position: number;
  title: string | null;
  artist: string;
  duration: number | null;
  available: boolean;
}

export interface DupGroup {
  tier: Tier;
  reason: string;
  /** Index into items of the copy to keep (keeper sorts first). */
  keep: number;
  items: DupItem[];
}

interface Row extends DupItem {
  c: ReturnType<typeof clean>;
}

/**
 * Group true duplicates in a playlist (live track list, so each copy has its own setVideoId).
 * exact: same video repeated. likely: same base title + identical variant tags + artist overlap +
 * duration within `tol` seconds. possible: same base title + tags only (never pre-selected by the UI).
 * Differing variant tags (cover, remix, slowed...) never group.
 */
export function dupGroups(tracks: Track[], tol = 3): DupGroup[] {
  const rows: Row[] = [];
  tracks.forEach((t, position) => {
    if (!t.videoId) return;
    const c = clean(t.title, t.artists);
    rows.push({ videoId: t.videoId, setVideoId: t.setVideoId ?? null, position, title: t.title, artist: c.artist, duration: t.duration, available: t.available, c });
  });

  const item = (r: Row): DupItem => ({ videoId: r.videoId, setVideoId: r.setVideoId, position: r.position, title: r.title, artist: r.artist, duration: r.duration, available: r.available });
  const group = (tier: Tier, reason: string, rs: Row[]): DupGroup => ({
    tier,
    reason,
    keep: 0,
    // keeper first: playable copies before greyed-out ones, then earliest position
    items: [...rs].sort((a, b) => Number(!a.available) - Number(!b.available) || a.position - b.position).map(item),
  });

  const out: DupGroup[] = [];
  const byVid = new Map<string, Row[]>();
  for (const r of rows) byVid.set(r.videoId, [...(byVid.get(r.videoId) ?? []), r]);
  const repeated = new Set([...byVid].filter(([, rs]) => rs.length > 1).map(([v]) => v));
  for (const v of repeated) out.push(group('exact', 'same video added more than once', byVid.get(v)!));

  // ponytail: exact-key buckets; typos/spelling variants won't match, add fuzzy bucketing if needed
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    if (!repeated.has(r.videoId) && r === byVid.get(r.videoId)![0] && r.c.key) {
      const k = bucketKey(r.c.key, r.c.tags);
      buckets.set(k, [...(buckets.get(k) ?? []), r]);
    }
  }
  for (const rs of buckets.values()) {
    if (rs.length < 2) continue;
    const clusters: Row[][] = [];
    for (const r of rs) {
      const cl = clusters.find((cl) => {
        const a = cl[0]!;
        return namesOverlap(r.c.names, a.c.names) && r.duration !== null && a.duration !== null && Math.abs(r.duration - a.duration) <= tol;
      });
      if (cl) cl.push(r);
      else clusters.push([r]);
    }
    for (const cl of clusters) {
      if (cl.length > 1) out.push(group('likely', 'same song and version, same artist and length (e.g. video vs lyric video)', cl));
    }
    const left = clusters.filter((cl) => cl.length === 1).map((cl) => cl[0]!);
    const big = clusters.filter((cl) => cl.length > 1);
    if (left.length === 1 && big.length) left.push(big[0]![0]!);
    if (left.length > 1) out.push(group('possible', 'same title and version, but different artist or length', left));
  }
  const order: Record<Tier, number> = { exact: 0, likely: 1, possible: 2 };
  return out.sort((a, b) => order[a.tier] - order[b.tier] || a.items[0]!.position - b.items[0]!.position);
}
