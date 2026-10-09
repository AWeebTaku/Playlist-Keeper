import type { Diff } from '../core/diff';
import { clean } from '../core/sanitize';
import type { Row } from '../core/compare';
import type { Status, Track } from '../core/types';
import type { Sql } from './sql';

export interface PlaylistRow {
  id: string;
  title: string;
  hidden: boolean;
  lastSync: number | null;
  total: number;
  missing: number;
  /** Cover art URL from YouTube, if known. */
  thumb: string | null;
  /** Fallback cover: a playable track of the playlist (its thumbnail is used when there is no `thumb`). */
  coverVideo: string | null;
}

export interface ItemRow {
  playlistId: string;
  videoId: string;
  title: string | null;
  artists: string;
  album: string | null;
  duration: number | null;
  setVideoId: string | null;
  position: number;
  firstSeen: number;
  lastSeen: number;
  status: Status;
  cleanTitle: string | null;
  cleanArtist: string | null;
  tags: string;
}

type Raw = Record<string, unknown>;
const chunks = <T>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const placeholders = (rows: number, cols: number) => Array.from({ length: rows }, () => `(${Array(cols).fill('?').join(',')})`).join(',');
const ITEM_COLS = 'playlist_id,video_id,title,artists,album,duration,set_video_id,position,first_seen,last_seen,status,clean_title,clean_artist,tags';

const toItem = (r: Raw): ItemRow => ({
  playlistId: r.playlist_id as string,
  videoId: r.video_id as string,
  title: (r.title as string | null) ?? null,
  artists: (r.artists as string | null) ?? '',
  album: (r.album as string | null) ?? null,
  duration: (r.duration as number | null) ?? null,
  setVideoId: (r.set_video_id as string | null) ?? null,
  position: (r.position as number | null) ?? 0,
  firstSeen: (r.first_seen as number | null) ?? 0,
  lastSeen: (r.last_seen as number | null) ?? 0,
  status: (r.status as Status | null) ?? 'ok',
  cleanTitle: (r.clean_title as string | null) ?? null,
  cleanArtist: (r.clean_artist as string | null) ?? null,
  tags: (r.tags as string | null) ?? '',
});

export interface Override {
  title: string | null;
  artist: string | null;
}

/** Cleaned display fields for a track, with the user's hand edit winning over the automatic result. */
export function cleanedFields(title: string | null, artists: string, ov?: Override) {
  const c = clean(title, artists);
  return { cleanTitle: ov?.title || c.title, cleanArtist: ov?.artist || c.artist, tags: c.tags.join(' | ') };
}

export class Repo {
  constructor(private readonly sql: Sql) {}

  // ---- playlists ----
  async playlists(): Promise<PlaylistRow[]> {
    const rows = await this.sql.select<Raw>(`SELECT p.id, p.title, p.hidden, p.last_sync, p.thumb,
      (SELECT video_id FROM items WHERE playlist_id=p.id AND status='ok' ORDER BY position LIMIT 1) cover_video,
      (SELECT count(*) FROM items WHERE playlist_id=p.id AND status!='replaced') total,
      (SELECT count(*) FROM items WHERE playlist_id=p.id AND status IN('unavailable','removed')) missing
      FROM playlists p ORDER BY p.title COLLATE NOCASE`);
    return rows.map((r) => ({ id: r.id as string, title: r.title as string, hidden: !!r.hidden, lastSync: (r.last_sync as number | null) ?? null, total: r.total as number, missing: r.missing as number, thumb: (r.thumb as string | null) ?? null, coverVideo: (r.cover_video as string | null) ?? null }));
  }

  async ensurePlaylist(id: string, title: string, thumb?: string | null): Promise<void> {
    await this.sql.execute('INSERT INTO playlists(id,title,last_sync,thumb) VALUES(?,?,0,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, thumb=COALESCE(excluded.thumb, playlists.thumb)', [id, title, thumb ?? null]);
  }

  /**
   * Save the title and cover of every playlist in the library list (adds new ones). Never touches `hidden` or `last_sync`,
   * and keeps a saved cover when the new read has none. One statement per 100 playlists.
   */
  async upsertLibrary(list: { id: string; title: string; thumb: string | null }[]): Promise<void> {
    for (const c of chunks(list, 100)) {
      await this.sql.execute(
        `INSERT INTO playlists(id,title,last_sync,thumb) VALUES ${c.map(() => '(?,?,0,?)').join(',')}
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, thumb=COALESCE(excluded.thumb, playlists.thumb)`,
        c.flatMap((p) => [p.id, p.title, p.thumb]),
      );
    }
  }

  async touchSynced(id: string, now: number): Promise<void> {
    await this.sql.execute('UPDATE playlists SET last_sync=? WHERE id=?', [now, id]);
  }

  async setHidden(id: string, hidden: boolean): Promise<void> {
    await this.sql.execute('UPDATE playlists SET hidden=? WHERE id=?', [hidden ? 1 : 0, id]);
  }

  async hiddenIds(): Promise<Set<string>> {
    return new Set((await this.sql.select<Raw>('SELECT id FROM playlists WHERE hidden=1')).map((r) => r.id as string));
  }

  // ---- overrides ----
  async overrides(): Promise<Map<string, Override>> {
    const rows = await this.sql.select<Raw>('SELECT video_id, title, artist FROM overrides');
    return new Map(rows.map((r) => [r.video_id as string, { title: (r.title as string | null) ?? null, artist: (r.artist as string | null) ?? null }]));
  }

  /** Hand-edit a cleaned title. A blank title removes the override and goes back to the automatic one. */
  async setOverride(videoId: string, title: string, artist?: string): Promise<void> {
    if (title.trim()) await this.sql.execute('INSERT OR REPLACE INTO overrides(video_id,title,artist) VALUES(?,?,?)', [videoId, title.trim(), artist?.trim() || null]);
    else await this.sql.execute('DELETE FROM overrides WHERE video_id=?', [videoId]);
    const ov = (await this.overrides()).get(videoId);
    const rows = await this.sql.select<Raw>('SELECT playlist_id, title, artists FROM items WHERE video_id=?', [videoId]);
    for (const r of rows) {
      const f = cleanedFields(r.title as string | null, (r.artists as string | null) ?? '', ov);
      await this.sql.execute('UPDATE items SET clean_title=?, clean_artist=?, tags=? WHERE playlist_id=? AND video_id=?', [f.cleanTitle, f.cleanArtist, f.tags, r.playlist_id, videoId]);
    }
  }

  // ---- items ----
  async stored(playlistId: string): Promise<{ videoId: string; status: Status }[]> {
    const rows = await this.sql.select<Raw>('SELECT video_id, status FROM items WHERE playlist_id=?', [playlistId]);
    return rows.map((r) => ({ videoId: r.video_id as string, status: r.status as Status }));
  }

  async items(playlistId: string): Promise<ItemRow[]> {
    return (await this.sql.select<Raw>("SELECT * FROM items WHERE playlist_id=? AND status!='replaced' ORDER BY position", [playlistId])).map(toItem);
  }

  async item(playlistId: string, videoId: string): Promise<ItemRow | null> {
    const r = await this.sql.select<Raw>('SELECT * FROM items WHERE playlist_id=? AND video_id=?', [playlistId, videoId]);
    return r[0] ? toItem(r[0]) : null;
  }

  /** Every playable-or-greyed track of the non-hidden playlists, for compare. */
  async compareRows(): Promise<(Row & { auto: boolean })[]> {
    const rows = await this.sql.select<Raw>(`SELECT i.playlist_id, i.video_id, i.title, i.artists FROM items i JOIN playlists p ON p.id=i.playlist_id
      WHERE i.status IN('ok','unavailable') AND p.hidden=0`);
    return rows.map((r) => ({ playlistId: r.playlist_id as string, videoId: r.video_id as string, title: (r.title as string | null) ?? null, artists: (r.artists as string | null) ?? '', auto: /^(LR|RD|SE)/u.test(r.playlist_id as string) }));
  }

  /** Store the result of diffTracks(). Greyed-out entries never overwrite a good saved title. */
  async applyDiff(playlistId: string, diff: Diff, now: number, overrides: Map<string, Override>): Promise<void> {
    const snap: unknown[][] = [];
    const light: unknown[][] = [];
    for (const u of diff.upserts) {
      const t = u.track;
      const f = u.snapshot ? cleanedFields(t.title, t.artists, overrides.get(u.videoId)) : null;
      const row = [playlistId, u.videoId, t.title, t.artists, t.album ?? null, t.duration, u.setVideoId, u.position, now, now, u.status, f?.cleanTitle ?? null, f?.cleanArtist ?? null, f?.tags ?? null];
      (u.snapshot ? snap : light).push(row);
    }
    for (const c of chunks(snap, 150)) {
      await this.sql.execute(
        `INSERT INTO items(${ITEM_COLS}) VALUES ${placeholders(c.length, 14)}
         ON CONFLICT(playlist_id,video_id) DO UPDATE SET title=excluded.title, artists=excluded.artists, album=excluded.album,
           duration=excluded.duration, set_video_id=excluded.set_video_id, position=excluded.position, last_seen=excluded.last_seen,
           status=excluded.status, clean_title=excluded.clean_title, clean_artist=excluded.clean_artist, tags=excluded.tags`,
        c.flat(),
      );
    }
    for (const c of chunks(light, 150)) {
      await this.sql.execute(
        `INSERT INTO items(${ITEM_COLS}) VALUES ${placeholders(c.length, 14)}
         ON CONFLICT(playlist_id,video_id) DO UPDATE SET status=excluded.status, set_video_id=excluded.set_video_id,
           position=excluded.position, last_seen=excluded.last_seen`,
        c.flat(),
      );
    }
    for (const c of chunks(diff.removed, 400)) {
      await this.sql.execute(`UPDATE items SET status='removed' WHERE playlist_id=? AND video_id IN (${c.map(() => '?').join(',')})`, [playlistId, ...c]);
    }
  }

  /** Record a video that was just added on YouTube (so compare sees it before the next sync). */
  async addItem(playlistId: string, t: Pick<Track, 'videoId' | 'title' | 'artists' | 'duration'>, now: number): Promise<void> {
    const pos = ((await this.sql.select<Raw>('SELECT max(position) m FROM items WHERE playlist_id=?', [playlistId]))[0]?.m as number | null) ?? 0;
    const f = t.title ? cleanedFields(t.title, t.artists, (await this.overrides()).get(t.videoId)) : null;
    await this.sql.execute(`INSERT OR IGNORE INTO items(${ITEM_COLS}) VALUES (?,?,?,?,NULL,?,NULL,?,?,?,'ok',?,?,?)`, [playlistId, t.videoId, t.title, t.artists, t.duration, pos + 1, now, now, f?.cleanTitle ?? null, f?.cleanArtist ?? null, f?.tags ?? null]);
  }

  /** Drop a playlist and its saved tracks from the local copy (the playlist no longer exists, or was only a test). */
  async forget(playlistId: string): Promise<void> {
    await this.sql.execute('DELETE FROM items WHERE playlist_id=?', [playlistId]);
    await this.sql.execute('DELETE FROM playlists WHERE id=?', [playlistId]);
  }

  async markReplaced(playlistId: string, videoId: string): Promise<void> {
    await this.sql.execute("UPDATE items SET status='replaced' WHERE playlist_id=? AND video_id=?", [playlistId, videoId]);
  }
}

