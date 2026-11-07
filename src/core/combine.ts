/** Planning for "Combine playlists": which songs go into the new playlist(s), in which order, and how they are split. Pure, no I/O. */
import { bucketKey, clean, namesOverlap } from './sanitize';

/** YouTube allows at most 5,000 videos in one playlist. */
export const PLAYLIST_LIMIT = 5000;

export type Order = 'playlist' | 'reverse' | 'turns' | 'title' | 'shuffle';

/** The part of a saved track the plan needs (ItemRow fits). */
export interface SourceItem {
  videoId: string;
  title: string | null;
  artists: string;
  duration: number | null;
  position: number;
  status: string;
  ytStatus: 'ok' | 'unavailable' | 'missing' | null;
}

export interface Source {
  id: string;
  title: string;
  items: SourceItem[];
}

export interface PlanTrack {
  videoId: string;
  title: string | null;
  artists: string;
  duration: number | null;
  /** Id of the playlist it was taken from. */
  from: string;
}

interface SourceReport {
  id: string;
  title: string;
  /** Entries the playlist holds (playable or greyed out). */
  total: number;
  added: number;
  /** Greyed out on Music, or unavailable on youtube.com. */
  unavailable: number;
  /** Already in the new playlist from an earlier source (same video, or same song and version). */
  duplicates: number;
}

export interface Plan {
  tracks: PlanTrack[];
  reports: SourceReport[];
}

export interface PlanOptions {
  order: Order;
  /** Also skip "likely" duplicates: same song and version with the same artist and length, but another upload. */
  likely: boolean;
  random?: () => number;
}

const LENGTH_TOLERANCE = 3; // seconds, as in the duplicate finder

/** Only playable songs go in: a greyed-out entry on Music, or one youtube.com lists as unavailable, is left out. */
const usable = (i: SourceItem) => i.status === 'ok' && i.ytStatus !== 'unavailable';

function shuffle<T>(xs: T[], random: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function arrange(lists: PlanTrack[][], order: Order, random: () => number): PlanTrack[] {
  switch (order) {
    case 'playlist':
      return lists.flat();
    case 'reverse':
      return lists.flatMap((l) => [...l].reverse());
    case 'turns': {
      const out: PlanTrack[] = [];
      for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) for (const l of lists) if (l[i]) out.push(l[i]!);
      return out;
    }
    case 'title': {
      const key = (t: PlanTrack) => clean(t.title, t.artists).title.toLowerCase();
      return lists.flat().map((t) => ({ t, k: key(t) })).sort((a, b) => a.k.localeCompare(b.k)).map((x) => x.t);
    }
    case 'shuffle':
      return shuffle(lists.flat(), random);
  }
}

/**
 * Build the combined track list. Sources are taken in the order given (that is the playlist order the user chose).
 * The first copy of a song in the final order stays; later copies count as duplicates of their own source.
 */
export function planCombine(sources: Source[], opts: PlanOptions): Plan {
  const reports: SourceReport[] = sources.map((s) => ({
    id: s.id,
    title: s.title,
    total: s.items.filter((i) => i.status === 'ok' || i.status === 'unavailable').length,
    added: 0,
    unavailable: s.items.filter((i) => (i.status === 'ok' || i.status === 'unavailable') && !usable(i)).length,
    duplicates: 0,
  }));
  const report = new Map(reports.map((r) => [r.id, r]));
  const lists = sources.map((s) =>
    s.items
      .filter(usable)
      .sort((a, b) => a.position - b.position)
      .map((i): PlanTrack => ({ videoId: i.videoId, title: i.title, artists: i.artists, duration: i.duration, from: s.id })),
  );

  const seen = new Set<string>();
  const byKey = new Map<string, { names: Set<string>; duration: number }[]>();
  const tracks: PlanTrack[] = [];
  for (const t of arrange(lists, opts.order, opts.random ?? Math.random)) {
    const r = report.get(t.from)!;
    if (seen.has(t.videoId)) {
      r.duplicates++;
      continue;
    }
    let same = false;
    const c = opts.likely && t.title && t.duration !== null ? clean(t.title, t.artists) : null;
    const bucket = c?.key ? bucketKey(c.key, c.tags) : null;
    if (c && bucket) same = (byKey.get(bucket) ?? []).some((e) => namesOverlap(c.names, e.names) && Math.abs(e.duration - t.duration!) <= LENGTH_TOLERANCE);
    if (same) {
      r.duplicates++;
      continue;
    }
    seen.add(t.videoId);
    if (c && bucket) (byKey.get(bucket) ?? byKey.set(bucket, []).get(bucket)!).push({ names: c.names, duration: t.duration! });
    r.added++;
    tracks.push(t);
  }
  return { tracks, reports };
}

/** Cut the list into playlists of at most `limit` songs, in order. */
export function splitParts<T>(items: T[], limit = PLAYLIST_LIMIT): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += limit) out.push(items.slice(i, i + limit));
  return out;
}

/** "Name", then "Name (2)", "Name (3)" for the playlists that continue it. */
export const partTitles = (base: string, count: number): string[] => Array.from({ length: count }, (_, i) => (i === 0 ? base : `${base} (${i + 1})`));
