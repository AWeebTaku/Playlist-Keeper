import { describe, expect, it } from 'vitest';
import { compare, whereElse, type Row } from './compare';
import { dupGroups } from './dupes';
import { diffTracks } from './diff';
import { rankFull, type Hit } from './full';
import { ratio, score } from './score';
import type { Status, Track } from './types';

const T = (videoId: string, title: string | null, o: Partial<Track> = {}): Track => ({
  videoId, title, artists: 'A', duration: 200, available: true, setVideoId: 's' + videoId, ...o,
});

describe('dupGroups', () => {
  const tiers = (ts: Track[]) => dupGroups(ts).map((g) => [g.tier, g.items.map((i) => i.videoId)]);
  it('groups the same recording in different packaging as likely, keeper first', () => {
    expect(tiers([T('1', 'Song (Official Video)'), T('2', 'A - Song [Lyrics]', { duration: 201 })])).toEqual([['likely', ['1', '2']]]);
    expect(tiers([T('1', 'Song', { available: false }), T('2', 'Song (Lyrics)')])).toEqual([['likely', ['2', '1']]]);
  });
  it('never groups variants with the original or with each other', () => {
    for (const v of ['Song (Slowed)', 'Song (Remix)', 'Song (Cover)', 'Song (Nightcore)', 'Song (Live)', 'Song (???)']) {
      expect(tiers([T('1', 'Song'), T('2', v)]), v).toEqual([]);
    }
    expect(tiers([T('1', 'Song (X Remix)'), T('2', 'Song (Y Remix)')])).toEqual([]);
    expect(tiers([T('1', 'Song (X Remix)'), T('2', 'Song [X Remix] (Official Video)')])[0]![0]).toBe('likely');
  });
  it('finds exact repeats', () => {
    expect(tiers([T('1', 'Song'), T('2', 'Other'), T('1', 'Song', { setVideoId: 'again' })])).toEqual([['exact', ['1', '1']]]);
  });
  it('different artist or length is only possible', () => {
    expect(tiers([T('1', 'Song', { artists: 'A' }), T('2', 'Song', { artists: 'B' })])).toEqual([['possible', ['1', '2']]]);
    expect(tiers([T('1', 'Song', { duration: 200 }), T('2', 'Song', { duration: 260 })])).toEqual([['possible', ['1', '2']]]);
  });
  it('uses the uploader-channel artist from the title', () => {
    expect(tiers([T('1', 'Dynasty', { artists: 'MIIA' }), T('2', 'MIIA - Dynasty (Lyrics)', { artists: 'Equilanora' })])).toEqual([['likely', ['1', '2']]]);
  });
});

describe('diffTracks', () => {
  const stored = (...s: [string, Status][]) => s.map(([videoId, status]) => ({ videoId, status }));
  it('flags unavailable, removed, and keeps good snapshots', () => {
    const d = diffTracks(stored(['a', 'ok'], ['b', 'ok'], ['c', 'ok']), [T('a', null, { available: false }), T('c', 'Song C')]);
    const a = d.upserts.find((u) => u.videoId === 'a')!;
    expect(a.status).toBe('unavailable');
    expect(a.snapshot).toBe(false); // an existing good title must not be overwritten
    expect(d.removed).toEqual(['b']);
    expect(d.upserts.find((u) => u.videoId === 'c')!.snapshot).toBe(true);
  });
  it('stores a brand-new greyed-out entry as-is, and recovers when it comes back', () => {
    expect(diffTracks([], [T('x', 'X', { available: false })]).upserts[0]).toMatchObject({ status: 'unavailable', snapshot: true });
    const back = diffTracks(stored(['a', 'unavailable'], ['b', 'removed']), [T('a', 'Song A'), T('b', 'Song B')]);
    expect(back.upserts.map((u) => u.status)).toEqual(['ok', 'ok']);
    expect(back.removed).toEqual([]);
  });
  it('does not re-remove entries already removed or replaced', () => {
    expect(diffTracks(stored(['r', 'removed'], ['p', 'replaced']), []).removed).toEqual([]);
  });
});

describe('compare', () => {
  const R = (playlistId: string, videoId: string, title: string): Row => ({ playlistId, videoId, title, artists: 'A' });
  const p = [R('P', 'a', 'Song A (Official Video)'), R('P', 'b', 'Song B'), R('P', 'c', 'Song C')];
  const q = [R('Q', 'z', 'Song A [Lyrics]'), R('Q', 'y', 'Song B (Remix)'), R('Q', 'c', 'Song C')];
  it('whereElse: same song and same video match, a remix does not', () => {
    const w = whereElse(p, q);
    expect(w.get('a')).toEqual([{ playlistId: 'Q', how: 'same song' }]);
    expect(w.get('c')).toEqual([{ playlistId: 'Q', how: 'same video' }]);
    expect(w.has('b')).toBe(false);
  });
  it('A vs B adds up', () => {
    const r = compare(p, q);
    expect(r.both.map((x) => x.videoId)).toEqual(['a', 'c']);
    expect(r.onlyA.map((x) => x.videoId)).toEqual(['b']);
    expect(r.onlyB.map((x) => x.videoId)).toEqual(['y']);
  });
});

describe('score', () => {
  it('ratio matches difflib on known pairs', () => {
    expect(ratio('abcd', 'bcde')).toBeCloseTo(0.75, 5);
    expect(ratio('', '')).toBe(1);
    expect(ratio('abc', 'xyz')).toBe(0);
  });
  it('close title and duration beats an unrelated track', () => {
    const it = { artists: 'Artist', title: 'Song A (Official Video)', cleanTitle: 'Song A', cleanArtist: 'Artist', duration: 200 };
    const good = { title: 'Song A', artists: 'Artist', duration: 201 };
    const bad = { title: 'Other Thing', artists: 'Nobody', duration: 90 };
    expect(score(it, good)).toBeGreaterThan(0.9);
    expect(score(it, bad)).toBeLessThan(0.5);
  });
});

describe('rankFull', () => {
  const hit = (videoId: string, title: string, duration: number): Hit => ({ videoId, title, artists: 'X', duration });
  it('prefers the top result of the song+show query and drops clips that are too short', () => {
    const qs = ['Renegade GANGSTA.', 'Renegade', 'GANGSTA.'];
    const hits = [
      [hit('right', 'Renegade', 245), hit('lidk', 'Renegade (Remix)', 181)],
      [hit('lidk', 'Renegade (Remix)', 181), hit('other', 'Renegade', 188), hit('tiny', 'Renegade', 92)],
      [],
    ];
    const r = rankFull({ videoId: 'clip', duration: 90 }, qs, hits);
    expect(r[0]!.videoId).toBe('right');
    expect(r.map((x) => x.videoId)).not.toContain('tiny'); // 92s is not >= max(126, 130)
    expect(r.map((x) => x.videoId)).not.toContain('clip');
  });
});
