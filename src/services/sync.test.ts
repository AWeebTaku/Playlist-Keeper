import { describe, expect, it } from 'vitest';
import { memorySql } from '../../tests/nodesql';
import type { Track } from '../core/types';
import { Repo } from './db';
import { AuthError } from './errors';
import { syncAll, type YtReader } from './sync';

const T = (videoId: string, title: string | null, o: Partial<Track> = {}): Track => ({ videoId, title, artists: 'Artist', duration: 200, available: true, setVideoId: 's' + videoId, album: null, ...o });

function fake(lists: Record<string, Track[] | Error>): YtReader {
  return {
    libraryPlaylists: async () => Object.keys(lists).map((id) => ({ id, title: 'List ' + id, count: null, thumb: id === 'P' ? 'https://i.ytimg.com/pl_c/cover.jpg' : null })),
    playlistTracks: async (id) => {
      const v = lists[id]!;
      if (v instanceof Error) throw v;
      return v;
    },
  };
}

describe('syncAll', () => {
  it('stores tracks with cleaned titles, then flags greyed-out and removed ones without losing the saved title', async () => {
    const repo = new Repo(memorySql());
    await syncAll(repo, fake({ P: [T('a', 'Song A (Official Video)'), T('b', 'Song B'), T('c', 'Song C')] }));
    expect((await repo.items('P')).map((i) => i.cleanTitle)).toEqual(['Song A', 'Song B', 'Song C']);
    await syncAll(repo, fake({ P: [T('a', null, { available: false }), T('c', 'Song C')] }));
    const items = Object.fromEntries((await repo.items('P')).map((i) => [i.videoId, i]));
    expect(items.a).toMatchObject({ status: 'unavailable', title: 'Song A (Official Video)', cleanTitle: 'Song A' }); // snapshot kept
    expect(items.b!.status).toBe('removed');
    expect(items.c!.status).toBe('ok');
    const [pl] = await repo.playlists();
    expect(pl).toMatchObject({ total: 3, missing: 2 });
    await syncAll(repo, fake({ P: [T('a', 'Song A (Official Video)'), T('b', 'Song B'), T('c', 'Song C')] }));
    expect((await repo.items('P')).every((i) => i.status === 'ok')).toBe(true); // all came back
  });

  it('skips hidden playlists and reports unreadable ones', async () => {
    const repo = new Repo(memorySql());
    await syncAll(repo, fake({ H: [T('h', 'Hidden song')], P: [T('p', 'Song')] }));
    await repo.setHidden('H', true);
    const r = await syncAll(repo, fake({ H: new Error('boom'), P: [T('p', 'Song'), T('q', 'New')], M: new Error('KeyError: contents') }));
    expect(r.synced).toBe(1);
    expect(r.skipped).toEqual([{ title: 'List M', reason: 'KeyError: contents' }]);
    expect((await repo.items('P')).length).toBe(2);
    expect((await repo.items('H')).length).toBe(1); // untouched, still there
  });

  it('never treats an empty answer as "everything was removed"', async () => {
    const repo = new Repo(memorySql());
    await syncAll(repo, fake({ P: [T('a', 'A'), T('b', 'B')] }));
    const r = await syncAll(repo, fake({ P: [] }));
    expect(r.skipped).toHaveLength(1);
    expect((await repo.items('P')).every((i) => i.status === 'ok')).toBe(true);
  });

  it('aborts on a sign-in error', async () => {
    const repo = new Repo(memorySql());
    await expect(syncAll(repo, fake({ P: new AuthError('401') }))).rejects.toBeInstanceOf(AuthError);
  });

  it('reports progress', async () => {
    const seen: number[] = [];
    await syncAll(new Repo(memorySql()), fake({ A: [T('a', 'A')], B: [T('b', 'B')] }), (p) => seen.push(p.done));
    expect(seen.at(-1)).toBe(2);
  });
});

describe('overrides and replaced items', () => {
  it('a hand-edited name survives re-sync and can be cleared', async () => {
    const repo = new Repo(memorySql());
    await syncAll(repo, fake({ P: [T('a', 'Song A (Official Video)')] }));
    await repo.setOverride('a', 'My Name');
    await syncAll(repo, fake({ P: [T('a', 'Song A (Official Video)')] }));
    expect((await repo.items('P'))[0]!.cleanTitle).toBe('My Name');
    await repo.setOverride('a', '');
    expect((await repo.items('P'))[0]!.cleanTitle).toBe('Song A');
  });

  it('addItem records a new track; markReplaced hides the old one', async () => {
    const repo = new Repo(memorySql());
    await syncAll(repo, fake({ P: [T('a', 'Clip')] }));
    await repo.addItem('P', { videoId: 'full', title: 'Full Song (Lyrics)', artists: 'Artist', duration: 240 }, 1);
    await repo.markReplaced('P', 'a');
    const items = await repo.items('P');
    expect(items.map((i) => i.videoId)).toEqual(['full']);
    expect(items[0]!.cleanTitle).toBe('Full Song');
  });

  it('forget removes a playlist and its tracks from the local copy only', async () => {
    const repo = new Repo(memorySql());
    await syncAll(repo, fake({ P: [T('a', 'A')], Q: [T('b', 'B')] }));
    await repo.forget('P');
    expect((await repo.playlists()).map((p) => p.id)).toEqual(['Q']);
    expect(await repo.items('P')).toEqual([]);
  });

  it('stores cover art, keeps it when a later read has none, and offers a track cover as fallback', async () => {
    const repo = new Repo(memorySql());
    await syncAll(repo, fake({ P: [T('a', 'A'), T('b', 'B')], Q: [T('c', 'C', { available: false })] }));
    const lists = Object.fromEntries((await repo.playlists()).map((p) => [p.id, p]));
    expect(lists.P).toMatchObject({ thumb: 'https://i.ytimg.com/pl_c/cover.jpg', coverVideo: 'a' });
    expect(lists.Q).toMatchObject({ thumb: null, coverVideo: null }); // nothing playable to use as a cover
    await repo.ensurePlaylist('P', 'List P', null);
    expect((await repo.playlists()).find((p) => p.id === 'P')!.thumb).toBe('https://i.ytimg.com/pl_c/cover.jpg');
  });

  it('migration 2 upgrades a database created by the first release without losing anything', async () => {
    const sql = memorySql(1); // what the released app has today
    await sql.execute("INSERT INTO playlists(id,title,last_sync,hidden) VALUES('X','Old',5,1)");
    await sql.execute("INSERT INTO items(playlist_id,video_id,title,artists,duration,position,status) VALUES('X','v','Song','Someone',100,0,'unavailable')");
    const { readFileSync } = await import('node:fs');
    sql.raw.exec(readFileSync(new URL('../../src-tauri/migrations/002_playlist_thumb.sql', import.meta.url), 'utf8'));
    expect(await new Repo(sql).playlists()).toEqual([{ id: 'X', title: 'Old', hidden: true, lastSync: 5, total: 1, missing: 1, thumb: null, coverVideo: null }]);
  });

  it('upsertLibrary adds playlists and updates covers without touching hidden, last_sync or an existing cover', async () => {
    const repo = new Repo(memorySql());
    await syncAll(repo, fake({ P: [T('a', 'A')] }));
    await repo.setHidden('P', true);
    await repo.upsertLibrary([
      { id: 'P', title: 'Renamed', thumb: null }, // no cover in this read: keep the saved one
      { id: 'N', title: 'New one', thumb: 'https://i.ytimg.com/pl_c/new.jpg' },
    ]);
    const lists = Object.fromEntries((await repo.playlists()).map((p) => [p.id, p]));
    expect(lists.P).toMatchObject({ title: 'Renamed', hidden: true, thumb: 'https://i.ytimg.com/pl_c/cover.jpg', total: 1 });
    expect(lists.P!.lastSync).toBeGreaterThan(0);
    expect(lists.N).toMatchObject({ title: 'New one', hidden: false, thumb: 'https://i.ytimg.com/pl_c/new.jpg', lastSync: 0, total: 0 });
    await repo.upsertLibrary([{ id: 'N', title: 'New one', thumb: 'https://i.ytimg.com/pl_c/newer.jpg' }]);
    expect((await repo.playlists()).find((p) => p.id === 'N')!.thumb).toBe('https://i.ytimg.com/pl_c/newer.jpg');
  });
});
