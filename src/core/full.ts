import { normForScore, ratio, round2 } from './score';

export interface Hit {
  videoId: string;
  title: string | null;
  artists: string;
  duration: number | null;
}

export interface FullCandidate {
  videoId: string;
  title: string | null;
  artists: string;
  duration: number;
  score: number;
  query: string;
}

/** A full version must be clearly longer than the clip. */
const minFullDuration = (d: number | null): number => (d ? Math.max(d * 1.4, d + 40) : 0);

/**
 * Rank search results as possible full versions of a short clip. `hits[i]` are the results of `queries[i]`
 * in YouTube Music's order. The first query (song + show) is the most specific, so its rank counts most.
 */
export function rankFull(clip: { videoId: string; duration: number | null }, queries: string[], hits: Hit[][], n = 5): FullCandidate[] {
  const need = minFullDuration(clip.duration);
  const qn = queries.map(normForScore);
  const found = new Map<string, FullCandidate>();
  hits.forEach((list, qi) => {
    list.forEach((h, rank) => {
      if (!h.videoId || h.videoId === clip.videoId || (need && (!h.duration || h.duration < need))) return;
      const title = normForScore(h.title);
      const sim = Math.max(...qn.map((q) => ratio(q, title)));
      const score = round2(Math.min(1, 0.6 * sim + (qi === 0 ? 0.4 / (1 + rank) : 0)));
      const prev = found.get(h.videoId);
      if (!prev || score > prev.score) found.set(h.videoId, { videoId: h.videoId, title: h.title, artists: h.artists, duration: h.duration ?? 0, score, query: queries[qi]! });
    });
  });
  return [...found.values()].sort((a, b) => b.score - a.score || b.duration - a.duration).slice(0, n);
}
