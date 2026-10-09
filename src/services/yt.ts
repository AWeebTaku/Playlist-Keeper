/**
 * YouTube Music access: youtubei.js for the session, auth and search, raw `browse` responses for playlists
 * (see parse.ts for why). All requests go through the Rust shell (http.ts), which enforces the host allow-list.
 */
import { Innertube } from 'youtubei.js/web';
import type { Hit } from '../core/full';
import type { Track } from '../core/types';
import { AuthError, asAuthError } from './errors';
import { rustFetch } from './http';
import { continuationToken, isSignedOut, parseAccountMenu, parseLibraryPlaylists, parseTracks, type LibraryPlaylist, type Profile } from './parse';
import type { YtReader } from './sync';

const baseOptions = () => ({ fetch: rustFetch as typeof fetch, retrieve_player: false });

export const createClient = (cookie: string): Promise<Innertube> => Innertube.create({ ...baseOptions(), cookie });

const joinNames = (xs?: { name?: string }[]) => (xs ?? []).map((a) => a.name).filter(Boolean).join(', ');

export class Yt implements YtReader {
  constructor(private readonly yt: Innertube) {}

  private async browse(body: { browseId: string } | { continuation: string }): Promise<unknown> {
    try {
      const r = await this.yt.actions.execute('/browse', { ...body, client: 'YTMUSIC', parse: false });
      if (isSignedOut(r.data)) throw new AuthError('YouTube did not accept this login (it answered as signed out).');
      return r.data;
    } catch (e) {
      throw asAuthError(e);
    }
  }

  /** Read a browse page and all its continuations. */
  private async pages(first: string, each: (page: unknown) => void): Promise<void> {
    let page = await this.browse({ browseId: first });
    each(page);
    for (let token = continuationToken(page); token; token = continuationToken(page)) {
      page = await this.browse({ continuation: token });
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
    await this.pages('FEmusic_liked_playlists', (p) => out.push(...parseLibraryPlaylists(p)));
    return out;
  }

  async playlistTracks(id: string): Promise<Track[]> {
    const out: Track[] = [];
    await this.pages(id.startsWith('VL') ? id : `VL${id}`, (p) => out.push(...parseTracks(p)));
    return out;
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
      await this.yt.playlist.addVideos(playlistId, videoIds);
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
