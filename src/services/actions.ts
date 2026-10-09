/** What the screens do: search, add, replace, remove, scan, compare. Plain functions over Repo + a YouTube client. */
import { buildIndex, compare, whereIn, type How, type Row } from '../core/compare';
import { dupGroups, type DupGroup } from '../core/dupes';
import { rankFull, type FullCandidate, type Hit } from '../core/full';
import { score } from '../core/score';
import { shortQueryVariants } from '../core/sanitize';
import type { ItemRow, Repo } from './db';
import { syncPlaylist, type YtReader } from './sync';

export interface YtClient extends YtReader {
  search(query: string, type?: 'song' | 'video'): Promise<Hit[]>;
  addVideos(playlistId: string, videoIds: string[]): Promise<void>;
  removeEntries(playlistId: string, setVideoIds: string[]): Promise<void>;
}

export type NewTrack = { videoId: string; title: string | null; artists: string; duration: number | null };

const nowSeconds = () => Date.now() / 1000;

// ---- replacements for greyed-out entries ----------------------------------------------------

export interface Replacement extends NewTrack {
  type: 'song' | 'video';
  score: number;
}

/** Search songs and videos for something that looks like the lost track, best match first. */
export async function findReplacements(yt: YtClient, item: ItemRow, n = 5): Promise<Replacement[]> {
  const title = item.cleanTitle || item.title;
  if (!title) return []; // nothing was ever saved, so there is nothing to search for
  const query = `${item.cleanArtist || item.artists} ${title}`.trim();
  const found = new Map<string, Replacement>();
  for (const type of ['song', 'video'] as const) {
    for (const h of await yt.search(query, type)) {
      if (h.videoId === item.videoId || found.has(h.videoId)) continue;
      found.set(h.videoId, { ...h, type, score: Math.round(score(item, h) * 100) / 100 });
    }
  }
  return [...found.values()].sort((a, b) => b.score - a.score).slice(0, n);
}

/** Add a video to a playlist on YouTube and record it locally. */
export async function addTrack(repo: Repo, yt: YtClient, playlistId: string, t: NewTrack): Promise<void> {
  await yt.addVideos(playlistId, [t.videoId]);
  await repo.addItem(playlistId, t, nowSeconds());
}

/**
 * Add `t`, then remove the old entry when it is greyed out (or `force`), and mark it replaced.
 * The add happens first, so a failure never leaves the playlist without both.
 */
export async function replaceTrack(repo: Repo, yt: YtClient, playlistId: string, oldVideoId: string, t: NewTrack, force = false): Promise<void> {
  let old = await repo.item(playlistId, oldVideoId);
  if (!old) throw new Error('That track is not in the saved copy of this playlist. Sync first.');
  const remove = force || old.status === 'unavailable';
  if (remove && !old.setVideoId) {
    // added moments ago: its setVideoId is only known after a refresh
    const p = (await repo.playlists()).find((x) => x.id === playlistId);
    await syncPlaylist(repo, yt, { id: playlistId, title: p?.title ?? playlistId });
    old = (await repo.item(playlistId, oldVideoId)) ?? old;
  }
  await addTrack(repo, yt, playlistId, t);
  if (remove && old.setVideoId) await yt.removeEntries(playlistId, [old.setVideoId]);
  await repo.markReplaced(playlistId, oldVideoId);
}

// ---- duplicates -------------------------------------------------------------------------------

/** Live scan (not the saved copy), so every repeated entry has its own setVideoId. */
export async function scanDuplicates(yt: YtClient, playlistId: string): Promise<DupGroup[]> {
  return dupGroups(await yt.playlistTracks(playlistId));
}

/** Remove entries by setVideoId, then refresh that playlist's saved copy. Returns how many were removed. */
export async function removeEntries(repo: Repo, yt: YtClient, playlistId: string, setVideoIds: string[]): Promise<number> {
  const ids = [...new Set(setVideoIds.filter(Boolean))];
  if (!ids.length) throw new Error('Nothing to remove (entries need a setVideoId; is this your playlist?)');
  await yt.removeEntries(playlistId, ids);
  const p = (await repo.playlists()).find((x) => x.id === playlistId);
  await syncPlaylist(repo, yt, { id: playlistId, title: p?.title ?? playlistId });
  return ids.length;
}

// ---- compare ------------------------------------------------------------------------------------

export interface Elsewhere {
  playlistId: string;
  title: string;
  how: How;
}

/** For each track of the playlist: other playlists that already contain it (same video, or same song and version). */
export async function whereElse(repo: Repo, playlistId: string, includeAuto: boolean): Promise<Map<string, Elsewhere[]>> {
  const [rows, lists] = await Promise.all([repo.compareRows(), repo.playlists()]);
  const titles = new Map(lists.map((p) => [p.id, p.title]));
  const idx = buildIndex(rows.filter((r) => r.playlistId !== playlistId && (includeAuto || !r.auto)));
  const out = new Map<string, Elsewhere[]>();
  for (const it of rows.filter((r) => r.playlistId === playlistId)) {
    const w = whereIn(it, idx);
    if (w.size) out.set(it.videoId, [...w].map(([id, how]) => ({ playlistId: id, title: titles.get(id) ?? id, how })));
  }
  return out;
}

/** A vs B: only in A, in both, only in B (removed and replaced entries are not in the playlist any more). */
export async function compareLists(repo: Repo, a: string, b: string) {
  const live = async (id: string) => (await repo.items(id)).filter((i) => i.status === 'ok' || i.status === 'unavailable');
  return compare<ItemRow & Row>(await live(a), await live(b));
}

// ---- short clips: find the full-length song ---------------------------------------------------

export interface FullVersion extends FullCandidate {
  inPlaylist: boolean;
  /** Titles of other playlists that already hold it. */
  elsewhere: string[];
}

export async function fullVersions(repo: Repo, yt: YtClient, playlistId: string, item: ItemRow): Promise<{ candidates: FullVersion[]; queries: string[] }> {
  const queries = shortQueryVariants(item.title ?? item.cleanTitle, item.artists);
  if (!queries.length) return { candidates: [], queries };
  const hits = await Promise.all(queries.map((q) => yt.search(q, 'song')));
  const ranked = rankFull({ videoId: item.videoId, duration: item.duration }, queries, hits);
  const [rows, lists] = await Promise.all([repo.compareRows(), repo.playlists()]);
  const titles = new Map(lists.map((p) => [p.id, p.title]));
  const idx = buildIndex(rows);
  const candidates = ranked.map((c) => {
    const w = whereIn({ videoId: c.videoId, title: c.title, artists: c.artists }, idx);
    return { ...c, inPlaylist: w.has(playlistId), elsewhere: [...w.keys()].filter((id) => id !== playlistId).map((id) => titles.get(id) ?? id).slice(0, 3) };
  });
  return { candidates, queries };
}
