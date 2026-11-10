/**
 * Contract test: the parsers against saved YouTube Music responses (tests/fixtures/*.json). If YouTube changes its
 * private API, replace a fixture with a fresh capture (see tests/fixtures/README.md) and this test shows what broke.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { continuationToken, isSignedOut, looksLikeLibraryPage, looksLikePlaylistPage, parseLibraryPlaylists, parseTracks } from '../src/services/parse';

const load = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('recorded responses', () => {
  it('playlist page: tracks, grey-out flag, setVideoIds and the next-page token', () => {
    const page = load('playlist-page.json');
    expect(looksLikePlaylistPage(page)).toBe(true);
    expect(isSignedOut(page)).toBe(false);
    expect(continuationToken(page)).toBe('NEXTPAGE');
    expect(parseTracks(page)).toEqual([
      { videoId: 'aaaaaaaaaaa', setVideoId: 'SET1', title: 'Song One', artists: 'Artist A', album: 'Album A', duration: 201, available: true },
      { videoId: 'bbbbbbbbbbb', setVideoId: 'SET2', title: 'Song Two', artists: 'Artist B', album: null, duration: 245, available: false },
    ]);
  });
  it('library page: playlists with count and cover, without the New playlist tile', () => {
    const page = load('library-page.json');
    expect(looksLikeLibraryPage(page)).toBe(true);
    expect(parseLibraryPlaylists(page)).toEqual([{ id: 'PLfixture', title: 'Road trip', count: 1204, thumb: 'https://i.ytimg.com/l.jpg' }]);
  });
});
