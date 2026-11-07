import { describe, expect, it } from 'vitest';
import { alignByPosition, locator, sameness, summarize, type Entry } from './sideBySide';

const E = (videoId: string, title: string, artists = 'Artist'): Entry => ({ videoId, title, artists });

describe('side by side', () => {
  it('tells the same video, the same song in another packaging, and different songs apart', () => {
    expect(sameness(E('a', 'Song'), E('a', 'Totally other'))).toBe('same-video');
    expect(sameness(E('a', 'Song (Official Video)'), E('b', 'Song [Lyrics]'))).toBe('same-song');
    expect(sameness(E('a', 'Song'), E('b', 'Song (Remix)'))).toBeNull(); // a remix is another song
    expect(sameness(E('a', 'Song'), E('b', 'Song', 'Someone Else'))).toBeNull();
    expect(sameness(E('a', 'Song'), E('b', 'Other'))).toBeNull();
    expect(sameness({ videoId: 'a', title: null, artists: '' }, E('b', 'Song'))).toBeNull();
  });
  it('pairs by position; the longer list ends with "only in" rows', () => {
    const pairs = alignByPosition([E('1', 'One'), E('2', 'Two'), E('3', 'Three')], [E('1', 'One'), E('9', 'Nine')]);
    expect(pairs.map((p) => [p.index, p.verdict])).toEqual([[1, 'same-video'], [2, 'different'], [3, 'only-a']]);
    expect(alignByPosition([E('1', 'One')], [E('1', 'One'), E('2', 'Two')]).map((p) => p.verdict)).toEqual(['same-video', 'only-b']);
    expect(alignByPosition([], [])).toEqual([]);
  });
  it('summarises', () => {
    const p = alignByPosition([E('1', 'One'), E('2', 'Two'), E('3', 'Three')], [E('1', 'One'), E('9', 'Nine')]);
    expect(summarize(p)).toEqual({ same: 1, different: 1, onlyA: 1, onlyB: 0 });
  });
  it('lines everything up again once the one extra song is taken out of its list', () => {
    const a = [E('1', 'One'), E('x', 'Only in A'), E('2', 'Two'), E('3', 'Three')];
    const b = [E('1', 'One'), E('2', 'Two'), E('3', 'Three')];
    expect(summarize(alignByPosition(a, b))).toMatchObject({ same: 1, different: 2, onlyA: 1 }); // one extra song shifts the rest
    expect(summarize(alignByPosition(a.filter((t) => t.videoId !== 'x'), b))).toEqual({ same: 3, different: 0, onlyA: 0, onlyB: 0 });
  });
  it('finds a song anywhere in the other list, by video or as the same song', () => {
    const b = [{ ...E('1', 'One'), n: 1 }, { ...E('2', 'Two (Official Video)'), n: 2 }, { ...E('3', 'Three (Remix)'), n: 3 }];
    const where = locator(b);
    expect(where(E('1', 'whatever'))).toMatchObject({ kind: 'same-video', found: { n: 1 } });
    expect(where(E('9', 'Two [Lyrics]'))).toMatchObject({ kind: 'same-song', found: { n: 2 } });
    expect(where(E('9', 'Three'))).toBeNull(); // the remix is another song
    expect(where(E('9', 'Two', 'Someone Else'))).toBeNull();
    expect(where({ videoId: '8', title: null, artists: '' })).toBeNull();
    expect(locator([])(E('1', 'One'))).toBeNull();
  });
});
