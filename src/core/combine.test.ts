import { describe, expect, it } from 'vitest';
import { PLAYLIST_LIMIT, partTitles, planCombine, splitParts, type Source, type SourceItem } from './combine';

const I = (videoId: string, title: string, position: number, o: Partial<SourceItem> = {}): SourceItem => ({ videoId, title, artists: 'Artist', duration: 200, position, status: 'ok', ytStatus: 'ok', ...o });
const S = (id: string, items: SourceItem[]): Source => ({ id, title: 'List ' + id, items });
const ids = (src: Source[], order: 'playlist' | 'reverse' | 'turns' | 'title' | 'shuffle' = 'playlist', likely = true, random?: () => number) => planCombine(src, { order, likely, random }).tracks.map((t) => t.videoId);

describe('planCombine', () => {
  const A = S('A', [I('a1', 'Zebra', 0), I('a2', 'Apple', 1), I('a3', 'Mango', 2)]);
  const B = S('B', [I('b1', 'Banana', 0), I('b2', 'Cherry', 1)]);

  it('follows the playlist order chosen, and each playlist\'s own order', () => {
    expect(ids([A, B])).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']);
    expect(ids([B, A])).toEqual(['b1', 'b2', 'a1', 'a2', 'a3']);
  });
  it('can reverse, take turns, sort by title and shuffle', () => {
    expect(ids([A, B], 'reverse')).toEqual(['a3', 'a2', 'a1', 'b2', 'b1']);
    expect(ids([A, B], 'turns')).toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
    expect(ids([A, B], 'title')).toEqual(['a2', 'b1', 'b2', 'a3', 'a1']); // Apple Banana Cherry Mango Zebra
    expect(ids([A, B], 'shuffle', true, () => 0).sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']);
  });
  it('uses the saved position, not the array order', () => {
    expect(ids([S('A', [I('x2', 'Two', 1), I('x1', 'One', 0)])])).toEqual(['x1', 'x2']);
  });

  it('leaves out greyed-out, removed and youtube.com-unavailable songs, and counts them', () => {
    const src = S('A', [I('ok', 'Fine', 0), I('grey', 'Grey', 1, { status: 'unavailable' }), I('gone', 'Gone', 2, { status: 'removed' }), I('web', 'Web', 3, { ytStatus: 'unavailable' }), I('miss', 'Missing on web', 4, { ytStatus: 'missing' }), I('new', 'Unchecked', 5, { ytStatus: null })]);
    const p = planCombine([src], { order: 'playlist', likely: true });
    expect(p.tracks.map((t) => t.videoId)).toEqual(['ok', 'miss', 'new']);
    expect(p.reports[0]).toMatchObject({ total: 5, added: 3, unavailable: 2, duplicates: 0 }); // removed entries are no longer in the playlist
  });

  it('skips the same video repeated across playlists; the first one in the final order stays', () => {
    const p = planCombine([S('A', [I('x', 'Song', 0), I('y', 'Other', 1)]), S('B', [I('x', 'Song', 0), I('z', 'Third', 1)])], { order: 'playlist', likely: true });
    expect(p.tracks.map((t) => t.videoId)).toEqual(['x', 'y', 'z']);
    expect(p.reports.map((r) => [r.added, r.duplicates])).toEqual([[2, 0], [1, 1]]);
  });
  it('skips the same song in another packaging, but never covers, remixes or different artists', () => {
    const a = S('A', [I('v1', 'Song (Official Video)', 0)]);
    const b = S('B', [I('v2', 'Song [Lyrics]', 0, { duration: 201 }), I('v3', 'Song (Remix)', 1), I('v4', 'Song (Cover)', 2), I('v5', 'Song', 3, { artists: 'Someone Else' }), I('v6', 'Song', 4, { duration: 260 })]);
    expect(ids([a, b])).toEqual(['v1', 'v3', 'v4', 'v5', 'v6']);
    expect(ids([a, b], 'playlist', false)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5', 'v6']); // "likely" skipping switched off
  });
  it('works with nothing selected or nothing usable', () => {
    expect(planCombine([], { order: 'turns', likely: true })).toEqual({ tracks: [], reports: [] });
    expect(ids([S('A', [I('g', 'Grey', 0, { status: 'unavailable' })])])).toEqual([]);
  });
});

describe('splitParts / partTitles', () => {
  it('cuts at the playlist limit', () => {
    const xs = Array.from({ length: PLAYLIST_LIMIT * 2 + 3 }, (_, i) => i);
    expect(splitParts(xs).map((p) => p.length)).toEqual([PLAYLIST_LIMIT, PLAYLIST_LIMIT, 3]);
    expect(splitParts([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitParts([])).toEqual([]);
  });
  it('names the continuation playlists', () => {
    expect(partTitles('Mix', 1)).toEqual(['Mix']);
    expect(partTitles('Mix', 3)).toEqual(['Mix', 'Mix (2)', 'Mix (3)']);
  });
});
