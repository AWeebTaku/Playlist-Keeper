/** Export and import of playlists as a readable JSON file. Pure: no files, no network. */
import type { Source, SourceItem } from './combine';

export const FORMAT = 'playlist-keeper/playlists';
const FORMAT_VERSION = 1;

type Web = 'ok' | 'unavailable' | 'missing';

/** What export needs of a saved track (ItemRow fits). */
interface ExportItem {
  videoId: string;
  title: string | null;
  artists: string;
  album: string | null;
  duration: number | null;
  position: number;
  status: string;
  ytStatus: Web | null;
}

export interface ExportList {
  id: string;
  title: string;
  lastSync: number | null;
  items: ExportItem[];
}

const q = (s: string) => JSON.stringify(s);
const MUSIC = 'https://music.youtube.com';

/**
 * The file text. Two-space indent, a fixed key order, and one track per line so a long playlist stays easy to scan:
 *
 *   { "position": 1, "title": "Midnight Drive", "artists": "Neon Harbor", ..., "status": "ok", "youtube": "ok" }
 */
export function buildExport(lists: ExportList[], meta: { app: string; now?: Date }): string {
  const head = [`  "format": ${q(FORMAT)}`, `  "version": ${FORMAT_VERSION}`, `  "exportedAt": ${q((meta.now ?? new Date()).toISOString())}`, `  "app": ${q(meta.app)}`];
  const blocks = lists.map((l) => {
    const tracks = [...l.items]
      .sort((a, b) => a.position - b.position)
      .map((t, i) =>
        JSON.stringify({ position: i + 1, title: t.title, artists: t.artists, album: t.album, durationSeconds: t.duration, videoId: t.videoId, status: t.status, youtube: t.ytStatus }).replace(/^\{/u, '{ ').replace(/\}$/u, ' }').replace(/,"/gu, ', "').replace(/":/gu, '": '),
      );
    const rows = tracks.map((t, i) => `        ${t}${i < tracks.length - 1 ? ',' : ''}`);
    return [
      '    {',
      `      "title": ${q(l.title)},`,
      `      "id": ${q(l.id)},`,
      `      "url": ${q(`${MUSIC}/playlist?list=${encodeURIComponent(l.id)}`)},`,
      `      "lastSynced": ${l.lastSync ? q(new Date(l.lastSync * 1000).toISOString()) : 'null'},`,
      `      "trackCount": ${l.items.length},`,
      `      "tracks": [${rows.length ? `\n${rows.join('\n')}\n      ` : ''}]`,
      '    }',
    ].join('\n');
  });
  const list = blocks.length ? `\n${blocks.join(',\n')}\n  ` : '';
  return `{\n${head.join(',\n')},\n  "playlists": [${list}]\n}\n`;
}

/** A file name for the export: the playlist title made safe, or a generic name for several. */
export function exportFileName(lists: { title: string }[], today = new Date()): string {
  const stamp = today.toISOString().slice(0, 10);
  const one = lists.length === 1 ? lists[0]!.title.replace(/[^\p{L}\p{N} _.-]+/gu, '').trim().slice(0, 60) : '';
  return `${one || 'Playlist Keeper playlists'} ${stamp}.json`;
}

const MAX_PLAYLISTS = 1000;
const MAX_TRACKS = 200_000;
const ID = /^[A-Za-z0-9_-]{5,64}$/u;
const STATUS = new Set(['ok', 'unavailable', 'removed', 'replaced']);
const WEB = new Set(['ok', 'unavailable', 'missing']);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown) => (typeof x === 'string' ? x : null);

/** Read an export file. Throws an Error with a message fit for the user when the file is not one of ours. */
export function parseExport(text: string): Source[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isObj(data) || data.format !== FORMAT) throw new Error('That is not a Playlist Keeper export file.');
  if (typeof data.version !== 'number' || data.version > FORMAT_VERSION) throw new Error('That file was made by a newer version of Playlist Keeper. Update the app and try again.');
  if (!Array.isArray(data.playlists)) throw new Error('The file has no playlists.');
  if (data.playlists.length > MAX_PLAYLISTS) throw new Error('The file holds too many playlists.');
  let seen = 0;
  return data.playlists.map((p: unknown, n): Source => {
    if (!isObj(p) || !Array.isArray(p.tracks)) throw new Error(`Playlist ${n + 1} in the file is damaged.`);
    const title = str(p.title)?.trim() || `Imported playlist ${n + 1}`;
    if ((seen += p.tracks.length) > MAX_TRACKS) throw new Error('The file holds too many songs.');
    const items: SourceItem[] = [];
    p.tracks.forEach((t: unknown, i) => {
      if (!isObj(t) || typeof t.videoId !== 'string' || !ID.test(t.videoId)) return; // a row without a usable video id cannot be copied
      const status = typeof t.status === 'string' && STATUS.has(t.status) ? t.status : 'ok';
      const youtube = typeof t.youtube === 'string' && WEB.has(t.youtube) ? (t.youtube as Web) : null;
      items.push({
        videoId: t.videoId,
        title: str(t.title),
        artists: str(t.artists) ?? '',
        duration: typeof t.durationSeconds === 'number' && Number.isFinite(t.durationSeconds) ? t.durationSeconds : null,
        position: typeof t.position === 'number' ? t.position : i,
        status,
        ytStatus: youtube,
      });
    });
    return { id: `file:${n}`, title, items };
  });
}
