import { describe, expect, it } from 'vitest';
import { memorySql } from '../../tests/nodesql';
import type { Hit } from '../core/full';
import type { Track } from '../core/types';
import { addTrack, compareLists, findReplacements, fullVersions, removeEntries, replaceTrack, scanDuplicates, whereElse, type YtClient } from './actions';
import { Repo } from './db';
import { syncAll } from './sync';

const T = (videoId: string, title: string | null, o: Partial<Track> = {}): Track => ({ videoId, title, artists: 'Artist', duration: 200, available: true, setVideoId: 's' + videoId, album: null, ...o });

/** In-memory YouTube: playlists are arrays; calls are recorded. */
function fakeYt(lists: Record<string, Track[]>, searchResults: Hit[] = []) {
  const calls: string[] = [];
  const yt: YtClient = {
    libraryPlaylists: async () => Object.keys(lists).map((id) => ({ id, title: 'List ' + id, count: null })),
    playlistTracks: async (id) => [...lists[id]!],
    search: async (q, type = 'song') => {
      calls.push(`search:${type}:${q}`);
      return searchResults;
    },
    addVideos: async (id, ids) => {
      calls.push(`add:${id}:${ids}`);
      lists[id]!.push(...ids.map((v) => T(v, 'Added ' + v)));
    },
    removeEntries: async (id, sets) => {
      calls.push(`remove:${id}:${sets}`);
      lists[id] = lists[id]!.filter((t) => !sets.includes(t.setVideoId!));
    },
  };
  return { yt, calls, lists };
}

async function setup(lists: Record<string, Track[]>, results: Hit[] = []) {
  const repo = new Repo(memorySql());
  const f = fakeYt(lists, results);
  await syncAll(repo, f.yt);
  return { repo, ...f };
}

describe('replacements', () => {
  it('finds, scores and replaces a greyed-out track (add first, then remove the old entry)', async () => {
    const { repo, yt, calls } = await setup({ P: [T('old', 'Song (Official Video)'), T('x', 'Other')] }, [
      { videoId: 'new', title: 'Song', artists: 'Artist', duration: 201 },
      { videoId: 'meh', title: 'Something else', artists: 'Nobody', duration: 90 },
    ]);
    // the clip goes grey on YouTube
    const grey = { P: [T('old', null, { available: false }), T('x', 'Other')] };
    const g = fakeYt(grey, []);
    await syncAll(repo, g.yt);
    const item = (await repo.item('P', 'old'))!;
    expect(item.status).toBe('unavailable');
    const found = await findReplacements(yt, item);
    expect(found[0]).toMatchObject({ videoId: 'new', type: 'song' });
    expect(found[0]!.score).toBeGreaterThan(found[1]!.score);
    expect(calls.filter((c) => c.startsWith('search:'))).toHaveLength(2); // songs and videos
    await replaceTrack(repo, g.yt, 'P', 'old', found[0]!);
    expect(g.calls).toEqual(['add:P:new', 'remove:P:sold']);
    expect((await repo.items('P')).map((i) => i.videoId)).toEqual(['x', 'new']);
  });

  it('does not remove a playable original unless forced; never searches without a saved title', async () => {
    const { repo, yt, calls } = await setup({ P: [T('clip', 'Clip')] });
    await replaceTrack(repo, yt, 'P', 'clip', { videoId: 'full', title: 'Full', artists: 'Artist', duration: 300 });
    expect(calls).toEqual(['add:P:full']);
    await replaceTrack(repo, yt, 'P', 'full', { videoId: 'full2', title: 'Full 2', artists: 'Artist', duration: 300 }, true);
    expect(calls).toContain('remove:P:sfull');
    await expect(replaceTrack(repo, yt, 'P', 'missing', { videoId: 'z', title: 'z', artists: '', duration: 1 })).rejects.toThrow(/Sync first/);
    expect(await findReplacements(yt, { ...(await repo.items('P'))[0]!, title: null, cleanTitle: null })).toEqual([]);
  });
});

describe('duplicates', () => {
  it('scans live, removes only the chosen entries and refreshes the saved copy', async () => {
    const { repo, yt, calls } = await setup({ P: [T('1', 'Song (Official Video)'), T('2', 'Song [Lyrics]', { duration: 201 }), T('3', 'Song (Remix)')] });
    const groups = await scanDuplicates(yt, 'P');
    expect(groups).toHaveLength(1); // the remix is not a duplicate
    const drop = groups[0]!.items[1]!;
    expect(await removeEntries(repo, yt, 'P', [drop.setVideoId!])).toBe(1);
    expect(calls).toContain('remove:P:s' + drop.videoId);
    const left = (await repo.items('P')).filter((i) => i.status === 'ok').map((i) => i.videoId).sort();
    expect(left).toEqual(['1', '3']);
    await expect(removeEntries(repo, yt, 'P', [])).rejects.toThrow(/Nothing to remove/);
  });
});

describe('compare', () => {
  const lists = { A: [T('a', 'Song A (Official Video)'), T('b', 'Song B'), T('c', 'Song C')], B: [T('z', 'Song A [Lyrics]'), T('y', 'Song B (Remix)'), T('c', 'Song C')], LR1: [T('b', 'Song B')] };
  it('whereElse excludes auto playlists unless asked', async () => {
    const { repo } = await setup(lists);
    const w = await whereElse(repo, 'A', false);
    expect(w.get('a')![0]).toMatchObject({ playlistId: 'B', title: 'List B', how: 'same song' });
    expect(w.get('c')![0]!.how).toBe('same video');
    expect(w.has('b')).toBe(false);
    expect((await whereElse(repo, 'A', true)).has('b')).toBe(true); // the recap holds Song B
  });
  it('A vs B adds up', async () => {
    const { repo } = await setup(lists);
    const r = await compareLists(repo, 'A', 'B');
    expect(r.both.map((i) => i.videoId)).toEqual(['a', 'c']);
    expect(r.onlyA.map((i) => i.videoId)).toEqual(['b']);
    expect(r.onlyB.map((i) => i.videoId)).toEqual(['y']);
  });
  it('addTrack makes the new track visible to compare before the next sync', async () => {
    const { repo, yt } = await setup(lists);
    await addTrack(repo, yt, 'B', { videoId: 'bb', title: 'Song B', artists: 'Artist', duration: 200 });
    expect((await compareLists(repo, 'A', 'B')).onlyA.map((i) => i.videoId)).toEqual([]);
  });
});

describe('fullVersions', () => {
  it('ranks longer songs and flags the ones already in a playlist', async () => {
    const hits: Hit[] = [
      { videoId: 'full', title: 'Renegade', artists: 'STEREO DIVE FOUNDATION', duration: 245 },
      { videoId: 'short', title: 'Renegade', artists: 'Someone', duration: 100 },
    ];
    const { repo, yt } = await setup({ P: [T('clip', 'GANGSTA. - Opening | Renegade', { artists: 'Crunchyroll', duration: 90 })], Q: [T('full', 'Renegade', { artists: 'STEREO DIVE FOUNDATION', duration: 245 })] }, hits);
    const item = (await repo.item('P', 'clip'))!;
    const r = await fullVersions(repo, yt, 'P', item);
    expect(r.queries[0]).toBe('Renegade GANGSTA.');
    expect(r.candidates.map((c) => c.videoId)).toEqual(['full']); // 100s is not clearly longer than a 90s clip
    expect(r.candidates[0]).toMatchObject({ inPlaylist: false, elsewhere: ['List Q'] });
  });
});
