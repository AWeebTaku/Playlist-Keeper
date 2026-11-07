import { describe, expect, it } from 'vitest';
import { memorySql } from '../../tests/nodesql';
import { planCombine } from '../core/combine';
import type { Track } from '../core/types';
import type { YtClient } from './actions';
import { addSongs, BATCH, loadSources, newRun, runCombine } from './combine';
import { Repo } from './db';
import { syncAll } from './sync';

const T = (videoId: string, title: string | null, o: Partial<Track> = {}): Track => ({ videoId, title, artists: 'Artist', duration: 200, available: true, setVideoId: 's' + videoId, album: null, ...o });

/** In-memory YouTube with playlists, youtube.com states, and creation. `failAdds` makes the Nth add call throw once. */
function fakeYt(lists: Record<string, Track[]>, web: Record<string, Map<string, 'ok' | 'unavailable'> | null> = {}, failAddAt = -1) {
  const calls: string[] = [];
  let addCalls = 0;
  const yt: YtClient = {
    libraryPlaylists: async () => Object.keys(lists).map((id) => ({ id, title: 'List ' + id, count: null, thumb: null })),
    playlistTracks: async (id) => [...lists[id]!],
    playlistWebStates: async (id) => web[id] ?? null,
    search: async () => [],
    createPlaylist: async (title, ids) => {
      const id = `NEW${Object.keys(lists).length}`;
      calls.push(`create:${title}:${ids.length}`);
      lists[id] = ids.map((v) => T(v, 'Song ' + v));
      return id;
    },
    addVideos: async (id, ids) => {
      if (addCalls++ === failAddAt) throw new Error('network down');
      calls.push(`add:${id}:${ids.length}`);
      lists[id]!.push(...ids.map((v) => T(v, 'Song ' + v)));
    },
    removeEntries: async () => undefined,
  };
  return { yt, calls, lists };
}

describe('youtube.com availability in sync', () => {
  it('saves per-track status from the youtube.com list and keeps the old one when that list cannot be read', async () => {
    const repo = new Repo(memorySql());
    const lists = { P: [T('a', 'A'), T('b', 'B', { available: false }), T('c', 'C', { available: false }), T('d', 'D')] };
    const f = fakeYt(lists, { P: new Map([['b', 'ok'], ['c', 'unavailable'], ['a', 'ok']]) });
    await syncAll(repo, f.yt);
    const by = () => repo.items('P').then((xs) => Object.fromEntries(xs.map((i) => [i.videoId, [i.status, i.ytStatus]])));
    expect(await by()).toEqual({ a: ['ok', 'ok'], b: ['unavailable', 'ok'], c: ['unavailable', 'unavailable'], d: ['ok', 'missing'] });
    await syncAll(repo, fakeYt(lists, { P: null }).yt); // youtube.com unreadable this time
    expect(await by()).toEqual({ a: ['ok', 'ok'], b: ['unavailable', 'ok'], c: ['unavailable', 'unavailable'], d: ['ok', 'missing'] });
  });
});

describe('combine', () => {
  async function setup(lists: Record<string, Track[]>, web = {}, failAddAt = -1) {
    const repo = new Repo(memorySql());
    const f = fakeYt(lists, web, failAddAt);
    await syncAll(repo, f.yt);
    return { repo, ...f };
  }

  it('reads the chosen playlists fresh, plans, creates the playlist, and saves it locally', async () => {
    const { repo, yt, calls, lists } = await setup({ A: [T('a1', 'One'), T('a2', 'Two', { available: false }), T('x', 'Shared')], B: [T('x', 'Shared'), T('b1', 'Three')] });
    lists.A!.push(T('a3', 'Brand new since the last sync')); // changed on YouTube after the last sync
    const sources = await loadSources(repo, yt, [{ id: 'B', title: 'List B' }, { id: 'A', title: 'List A' }]);
    const plan = planCombine(sources, { order: 'playlist', likely: true });
    expect(plan.tracks.map((t) => t.videoId)).toEqual(['x', 'b1', 'a1', 'a3']); // B first, shared once, greyed-out left out, new one included
    const run = newRun(plan.tracks, ['Mix']);
    const results = await runCombine(repo, yt, run);
    expect(calls).toEqual(['create:Mix:4']);
    expect(results).toEqual([{ title: 'Mix', id: 'NEW2', expected: 4, found: 4 }]);
    expect((await repo.playlists()).some((p) => p.id === 'NEW2' && p.title === 'Mix' && p.total === 4)).toBe(true);
  });

  it('continues in a new playlist when one is full, and sends songs in batches', async () => {
    const many = Array.from({ length: 5 }, (_, i) => T('v' + i, 'Song v' + i));
    const { repo, yt, calls } = await setup({ A: many });
    const run = newRun(planCombine(await loadSources(repo, yt, [{ id: 'A', title: 'List A' }]), { order: 'playlist', likely: false }).tracks, ['Big', 'Big (2)', 'Big (3)'], 2);
    expect(run.parts.map((p) => [p.title, p.tracks.length])).toEqual([['Big', 2], ['Big (2)', 2], ['Big (3)', 1]]);
    await runCombine(repo, yt, run);
    expect(calls).toEqual(['create:Big:2', 'create:Big (2):2', 'create:Big (3):1']);
    expect(BATCH).toBe(100);
  });

  it('adds more than one batch to the same playlist', async () => {
    const many = Array.from({ length: 250 }, (_, i) => T('v' + i, 'Song v' + i));
    const { repo, yt, calls } = await setup({ A: many });
    const run = newRun(planCombine(await loadSources(repo, yt, [{ id: 'A', title: 'A' }]), { order: 'playlist', likely: false }).tracks, ['All']);
    const [r] = await runCombine(repo, yt, run);
    expect(calls).toEqual(['create:All:100', 'add:NEW1:100', 'add:NEW1:50']);
    expect(r).toMatchObject({ expected: 250, found: 250 });
  });

  it('can be started again after a failure without creating or adding anything twice', async () => {
    const many = Array.from({ length: 250 }, (_, i) => T('v' + i, 'Song v' + i));
    const { repo, yt, calls, lists } = await setup({ A: many }, {}, 1); // the second add call fails once
    const run = newRun(planCombine(await loadSources(repo, yt, [{ id: 'A', title: 'A' }]), { order: 'playlist', likely: false }).tracks, ['All']);
    await expect(runCombine(repo, yt, run)).rejects.toThrow('network down');
    expect(run.parts[0]).toMatchObject({ id: 'NEW1', added: 200 });
    await runCombine(repo, yt, run);
    expect(calls).toEqual(['create:All:100', 'add:NEW1:100', 'add:NEW1:50']); // one create, no repeated batch
    expect(lists.NEW1).toHaveLength(250);
  });

  it('leaves out songs that youtube.com lists as unavailable', async () => {
    const { repo, yt } = await setup({ A: [T('a', 'Fine'), T('b', 'Deleted on youtube.com')] }, { A: new Map([['a', 'ok'], ['b', 'unavailable']]) });
    const plan = planCombine(await loadSources(repo, yt, [{ id: 'A', title: 'A' }]), { order: 'playlist', likely: true });
    expect(plan.tracks.map((t) => t.videoId)).toEqual(['a']);
    expect(plan.reports[0]).toMatchObject({ unavailable: 1 });
  });

  it('adds songs to an existing playlist in batches and refreshes its saved copy', async () => {
    const { repo, yt, calls } = await setup({ A: [T('a', 'Already here')] });
    const extra = Array.from({ length: 150 }, (_, i) => ({ videoId: 'n' + i, title: 'New ' + i, artists: 'Artist', duration: 200, from: 'file:0' }));
    const n = await addSongs(repo, yt, { id: 'A', title: 'List A' }, extra);
    expect(n).toBe(150);
    expect(calls).toEqual(['add:A:100', 'add:A:50']);
    expect((await repo.items('A')).length).toBe(151);
  });
});
