/**
 * YouTube Music access: youtubei.js for the session, auth and search, raw `browse` responses for playlists
 * (see parse.ts for why). All requests go through the Rust shell (http.ts), which enforces the host allow-list.
 */
import { Innertube } from 'youtubei.js/web';
import type { Hit } from '../core/full';
import type { Track } from '../core/types';
import { AuthError, FormatError, asAuthError } from './errors';
import { rustFetch } from './http';
import { continuationToken, isSignedOut, looksLikeLibraryPage, looksLikePlaylistPage, parseAccountMenu, parseLibraryPlaylists, parseTracks, rawTrackRows, parseWebStates, type LibraryPlaylist, type Profile } from './parse';
import type { YtReader } from './sync';

const baseOptions = () => ({ fetch: rustFetch as typeof fetch, retrieve_player: false });

export const createClient = (cookie: string): Promise<Innertube> => Innertube.create({ ...baseOptions(), cookie });

const joinNames = (xs?: { name?: string }[]) => (xs ?? []).map((a) => a.name).filter(Boolean).join(', ');

export class Yt implements YtReader {
  constructor(private readonly yt: Innertube) {}

  private async browse(body: { browseId: string } | { continuation: string }, client: 'YTMUSIC' | 'WEB' = 'YTMUSIC'): Promise<unknown> {
    try {
      const r = await this.yt.actions.execute('/browse', { ...body, client, parse: false });
      if (isSignedOut(r.data)) throw new AuthError('YouTube did not accept this login (it answered as signed out).');
      return r.data;
    } catch (e) {
      throw asAuthError(e);
    }
  }

  /** Read a browse page and all its continuations. */
  private async pages(first: string, each: (page: unknown) => void, client: 'YTMUSIC' | 'WEB' = 'YTMUSIC'): Promise<void> {
    let page = await this.browse({ browseId: first }, client);
    each(page);
    for (let token = continuationToken(page); token; token = continuationToken(page)) {
      page = await this.browse({ continuation: token }, client);
      each(page);
    }
  }

  /** Name, handle and photo of the signed-in account, or null when YouTube does not give them. */
  async profile(): Promise<Profile | null> {
    try {
      const r = await this.yt.actions.execute('/account/account_menu', { client: 'YTMUSIC', parse: false });
      return parseAccountMenu(r.data);
    } catch (e) {
      throw asAuthError(e);
    }
  }

  async libraryPlaylists(): Promise<LibraryPlaylist[]> {
    const out: LibraryPlaylist[] = [];
    let first = true;
    await this.pages('FEmusic_liked_playlists', (p) => {
      if (first && !looksLikeLibraryPage(p)) throw new FormatError('library page');
      first = false;
      out.push(...parseLibraryPlaylists(p));
    });
    return out;
  }

  async playlistTracks(id: string): Promise<Track[]> {
    const out: Track[] = [];
    let first = true;
    let rows = 0;
    await this.pages(id.startsWith('VL') ? id : `VL${id}`, (p) => {
      if (first && !looksLikePlaylistPage(p)) throw new FormatError('playlist page');
      first = false;
      rows += rawTrackRows(p);
      out.push(...parseTracks(p));
    });
    if (rows && !out.length) throw new FormatError('track rows'); // rows are there but none can be read
    return out;
  }

  /**
   * The same playlist as youtube.com lists it, to tell "greyed out on Music only" from "gone everywhere". Never fails the
   * sync: null means it could not be read (auto-generated mixes, offline, a page layout change), and callers keep what they had.
   */
  async playlistWebStates(id: string): Promise<Map<string, 'ok' | 'unavailable'> | null> {
    const webId = id === 'LM' ? 'LL' : id.replace(/^VL/u, ''); // Liked Music is the "Liked videos" list on youtube.com
    const out = new Map<string, 'ok' | 'unavailable'>();
    try {
      await this.pages(`VL${webId}`, (p) => parseWebStates(p).forEach((v, k) => { if (!out.has(k)) out.set(k, v); }), 'WEB');
    } catch {
      return null;
    }
    return out.size ? out : null;
  }

  async search(query: string, type: 'song' | 'video' = 'song'): Promise<Hit[]> {
    try {
      const res = await this.yt.music.search(query, { type });
      const list = (type === 'song' ? res.songs : res.videos)?.contents ?? [];
      return list
        .filter((s) => s.id)
        .map((s) => ({ videoId: s.id!, title: s.title ?? null, artists: joinNames(s.artists?.length ? s.artists : s.authors), duration: s.duration?.seconds ?? null }));
    } catch (e) {
      throw asAuthError(e);
    }
  }

  async addVideos(playlistId: string, videoIds: string[]): Promise<void> {
    try {
      // same request as youtubei.js's playlist.addVideos, but the answer is checked: YouTube can refuse with a 200
      const r = await this.yt.actions.execute('/browse/edit_playlist', { playlistId, actions: videoIds.map((id) => ({ action: 'ACTION_ADD_VIDEO', addedVideoId: id })), parse: false });
      const status = (r.data as { status?: string } | undefined)?.status;
      if (!r.success || (status && status !== 'STATUS_SUCCEEDED')) throw new Error(`YouTube did not add the songs${status ? ` (${status})` : ''}.`);
    } catch (e) {
      throw asAuthError(e);
    }
  }

  async createPlaylist(title: string, videoIds: string[]): Promise<string> {
    try {
      const r = await this.yt.actions.execute('/playlist/create', { title, privacyStatus: 'PRIVATE', videoIds, parse: false });
      const id = (r.data as { playlistId?: string } | undefined)?.playlistId;
      if (!r.success || !id) throw new Error('YouTube did not create the playlist.');
      return id;
    } catch (e) {
      throw asAuthError(e);
    }
  }

  /** Remove playlist entries by their setVideoId (the only way to remove one copy of a repeated video). */
  async removeEntries(playlistId: string, setVideoIds: string[]): Promise<void> {
    try {
      await this.yt.playlist.removeVideos(playlistId, setVideoIds, true);
    } catch (e) {
      throw asAuthError(e);
    }
  }
}
