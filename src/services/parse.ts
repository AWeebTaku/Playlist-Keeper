/**
 * Parsers for YouTube Music's raw `browse` responses. The parsed API of youtubei.js drops the two fields this
 * app depends on (the greyed-out flag and playlistSetVideoId), so playlists are read from the raw JSON.
 * Pure functions; port of the fields ytmusicapi reads.
 */
import type { Track } from '../core/types';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any -- raw third-party JSON

/** Depth-first, document-order search for objects holding `key`; does not descend into matches. */
function findAll(node: Json, key: string, out: Json[] = []): Json[] {
  if (Array.isArray(node)) {
    for (const x of node) findAll(x, key, out);
  } else if (node && typeof node === 'object') {
    if (key in node) out.push(node[key]);
    else for (const v of Object.values(node)) findAll(v, key, out);
  }
  return out;
}

const GREY = 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT';

/** "3:45" or "1:02:03" to seconds. */
export function parseDuration(text: string | undefined): number | null {
  if (!text || !/^\d+(:\d{1,2}){1,2}$/u.test(text.trim())) return null;
  return text.trim().split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
}

type Run = { text: string; navigationEndpoint?: Json };
const flexRuns = (col: Json): Run[] | null => col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? null;
const DURATION = /^(\d+:)*\d+:\d+$/u;

/** Artists alternate with separator runs ("A", " & ", "B"), so every other run is a name (as ytmusicapi does). */
function artistsFrom(runs: Run[] | null): string {
  const names: string[] = [];
  for (let i = 0; i < (runs?.length ?? 0); i += 2) if (runs![i]!.text) names.push(runs![i]!.text);
  return names.join(', ');
}

/**
 * Which flex column holds title / artist / album. Same rules as ytmusicapi's parse_playlist_item: columns are
 * recognised by what their first run links to; greyed-out entries have no links, so fixed columns are used.
 * One deliberate difference: when an upload's artist is a channel link, it wins over an unlinked column
 * (ytmusicapi would take the upload date as the artist there).
 */
function columns(r: Json, grey: boolean) {
  const flex: Json[] = r.flexColumns ?? [];
  let title: number | null = grey ? 0 : null;
  let artist: number | null = grey ? 1 : null;
  let album: number | null = grey ? 2 : null;
  const channels: number[] = [];
  let unrecognised: number | null = null;
  flex.forEach((col, i) => {
    const run = flexRuns(col)?.[0];
    const nav = run?.navigationEndpoint;
    if (!nav) {
      if (run?.text && !DURATION.test(run.text)) unrecognised ??= i;
      return;
    }
    if (nav.watchEndpoint) title = i;
    else if (nav.browseEndpoint) {
      const page = nav.browseEndpoint.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
      if (page === 'MUSIC_PAGE_TYPE_ARTIST' || page === 'MUSIC_PAGE_TYPE_UNKNOWN') artist = i;
      else if (page === 'MUSIC_PAGE_TYPE_ALBUM' || page === 'MUSIC_PAGE_TYPE_AUDIOBOOK') album = i;
      else if (page === 'MUSIC_PAGE_TYPE_USER_CHANNEL') channels.push(i);
      else if (page === 'MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE') title = i;
    }
  });
  artist ??= channels.at(-1) ?? unrecognised;
  return { flex, title, artist, album };
}

function parseTrack(r: Json): Track | null {
  const videoId: string | undefined = r.playlistItemData?.videoId;
  if (!videoId) return null;
  const grey = r.musicItemRendererDisplayPolicy === GREY;
  const { flex, title, artist, album } = columns(r, grey);
  const text = (i: number | null) => (i === null ? null : (flexRuns(flex[i])?.[0]?.text ?? null));
  const name = text(title);
  if (name === 'Song deleted') return null;
  const fixed = r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text;
  return {
    videoId,
    setVideoId: r.playlistItemData?.playlistSetVideoId ?? null,
    title: name,
    artists: artist === null ? '' : artistsFrom(flexRuns(flex[artist])),
    album: text(album),
    duration: parseDuration(fixed?.runs?.[0]?.text ?? fixed?.simpleText),
    available: !grey,
  };
}

/**
 * The playlist's own entries. Editable playlists can also carry a "suggestions" shelf of songs that are NOT in the
 * playlist, so only the playlist shelf (first page) or the continuation items (later pages) are read.
 */
function playlistEntries(page: Json): Json[] {
  const shelves = findAll(page, 'musicPlaylistShelfRenderer');
  const scopes = shelves.length ? shelves : [...findAll(page, 'musicPlaylistShelfContinuation'), ...findAll(page, 'appendContinuationItemsAction')];
  return scopes.flatMap((s) => findAll(s, 'musicResponsiveListItemRenderer'));
}

export const parseTracks = (page: Json): Track[] =>
  playlistEntries(page)
    .map(parseTrack)
    .filter((t): t is Track => t !== null);

/** Token for the next page, if any. */
export function continuationToken(page: Json): string | null {
  const a = findAll(page, 'continuationItemRenderer')[0]?.continuationEndpoint?.continuationCommand?.token;
  const b = findAll(page, 'nextContinuationData')[0]?.continuation;
  return a ?? b ?? null;
}

export interface LibraryPlaylist {
  id: string;
  title: string;
  /** Track count from the subtitle, if present (may differ from what can be read). */
  count: number | null;
  /** Cover art URL of the library tile, if any. */
  thumb: string | null;
}

export function parseLibraryPlaylists(page: Json): LibraryPlaylist[] {
  const out: LibraryPlaylist[] = [];
  for (const r of findAll(page, 'musicTwoRowItemRenderer')) {
    const browseId: string | undefined = r.navigationEndpoint?.browseEndpoint?.browseId;
    if (!browseId) continue; // the "New playlist" tile
    const title: string = (r.title?.runs ?? []).map((x: { text: string }) => x.text).join('');
    const sub: string = (r.subtitle?.runs ?? []).map((x: { text: string }) => x.text).join('');
    const n = /([\d,]+)\s+(?:tracks?|songs?)/iu.exec(sub);
    const thumbs: { url?: string }[] = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
    const thumb = thumbs.at(-1)?.url ?? null; // the largest one is listed last
    out.push({ id: browseId.replace(/^VL/u, ''), title, count: n ? Number(n[1]!.replace(/,/gu, '')) : null, thumb: thumb?.startsWith('https://') ? thumb : null });
  }
  return out;
}

export interface Profile {
  name: string;
  handle: string | null;
  /** Profile photo URL of the signed-in Google account. */
  photo: string | null;
}

/** The signed-in account from YouTube Music's account menu (`/account/account_menu`). */
export function parseAccountMenu(page: Json): Profile | null {
  const h = findAll(page, 'activeAccountHeaderRenderer')[0];
  const name: string | undefined = h?.accountName?.runs?.[0]?.text ?? h?.accountName?.simpleText;
  if (!name) return null;
  const photos: { url?: string }[] = h.accountPhoto?.thumbnails ?? [];
  const photo = photos.at(-1)?.url ?? null;
  return { name, handle: h.channelHandle?.runs?.[0]?.text ?? null, photo: photo?.startsWith('https://') ? photo : null };
}

/** True when YouTube answered as if nobody were signed in (the request was accepted but not authenticated). */
export function isSignedOut(page: Json): boolean {
  const services: Json[] = page?.responseContext?.serviceTrackingParams ?? [];
  const flag = services.flatMap((s) => s.params ?? []).find((p: { key: string }) => p.key === 'logged_in');
  return flag?.value === '0';
}
