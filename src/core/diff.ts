import type { Status, Track } from './types';

/** What the snapshot already knows about one playlist entry. */
export interface Stored {
  videoId: string;
  status: Status;
}

interface Upsert {
  videoId: string;
  position: number;
  status: 'ok' | 'unavailable';
  setVideoId: string | null;
  /** Overwrite title/artists/album/duration. False for greyed-out entries that were already saved. */
  snapshot: boolean;
  track: Track;
}

export interface Diff {
  upserts: Upsert[];
  /** Previously ok/unavailable entries that are no longer in the playlist. */
  removed: string[];
}

/**
 * Compare a fresh playlist listing with the stored snapshot. A greyed-out or title-less entry is
 * marked unavailable and never overwrites a good saved title (that is how lost tracks stay identifiable).
 */
export function diffTracks(stored: Iterable<Stored>, fresh: Track[]): Diff {
  const known = new Map<string, Stored>();
  for (const s of stored) known.set(s.videoId, s);
  const seen = new Set<string>();
  const upserts: Upsert[] = [];
  fresh.forEach((track, position) => {
    if (!track.videoId) return; // ponytail: rows with no videoId can't be keyed, so they're not tracked
    const isNew = !known.has(track.videoId) && !seen.has(track.videoId);
    seen.add(track.videoId);
    const bad = !track.available || !track.title;
    upserts.push({
      videoId: track.videoId,
      position,
      status: bad ? 'unavailable' : 'ok',
      setVideoId: track.setVideoId ?? null,
      snapshot: isNew || !bad,
      track,
    });
  });
  const removed = [...known.values()].filter((s) => (s.status === 'ok' || s.status === 'unavailable') && !seen.has(s.videoId)).map((s) => s.videoId);
  return { upserts, removed };
}
