import { describe, expect, it } from 'vitest';
import { activeCount, applyFilter, badLength, EMPTY, parseLength, type Criteria, type FilterItem } from './filter';

const I = (position: number, title: string, artists: string, o: Partial<FilterItem> = {}): FilterItem => ({ title, cleanTitle: title, artists, cleanArtist: artists, album: null, duration: 200, status: 'ok', ytStatus: null, position, firstSeen: position, ...o });
const items = [
  I(0, 'Midnight Drive', 'Neon Harbor', { album: 'After Dark', duration: 150 }),
  I(1, 'Opening 2 - Sunrise Parade', 'Crunchyroll', { duration: 84, status: 'unavailable', ytStatus: 'ok' }),
  I(2, 'Beyoncé Medley', 'Various', { duration: 300 }),
  I(3, 'Quiet Rooms', 'Elm Street', { duration: null, status: 'removed' }),
  I(4, 'Static Bloom', 'Neon Harbor', { duration: 245, ytStatus: 'unavailable' }),
];
const find = (c: Partial<Criteria>) => applyFilter(items, { ...EMPTY, ...c }).map((i) => i.position);

describe('parseLength', () => {
  it('reads m:ss, h:mm:ss and plain seconds', () => {
    expect([parseLength('2:30'), parseLength('1:02:03'), parseLength('150'), parseLength(' 3:05 ')]).toEqual([150, 3723, 150, 185]);
    expect([parseLength(''), parseLength('abc'), parseLength('2:75x'), parseLength('-5')]).toEqual([null, null, null, null]);
    expect([badLength(''), badLength('2:30'), badLength('2:3x')]).toEqual([false, false, true]);
  });
});

describe('applyFilter', () => {
  it('does nothing without filters', () => expect(find({})).toEqual([0, 1, 2, 3, 4]));
  it('searches title, artist and album together, ignoring case and accents, every word must match', () => {
    expect(find({ text: 'neon' })).toEqual([0, 4]);
    expect(find({ text: 'after dark' })).toEqual([0]); // album
    expect(find({ text: 'BEYONCE' })).toEqual([2]);
    expect(find({ text: 'neon bloom' })).toEqual([4]);
    expect(find({ text: '"midnight drive"' })).toEqual([0]);
    expect(find({ text: 'neon -bloom' })).toEqual([0]);
  });
  it('filters by field', () => {
    expect(find({ title: 'rooms' })).toEqual([3]);
    expect(find({ artist: 'neon' })).toEqual([0, 4]);
    expect(find({ album: 'dark' })).toEqual([0]);
    expect(find({ artist: 'neon', title: 'bloom' })).toEqual([4]);
  });
  it('filters by length; a track with no length never matches a length bound', () => {
    expect(find({ max: '2:30' })).toEqual([0, 1]);
    expect(find({ min: '4:00' })).toEqual([2, 4]);
    expect(find({ min: '2:00', max: '4:30' })).toEqual([0, 4]);
    expect(find({ min: 'junk' })).toEqual([0, 1, 2, 3, 4]); // unreadable bound is ignored
  });
  it('filters by status on Music and on youtube.com', () => {
    expect(find({ status: 'ok' })).toEqual([0, 2, 4]);
    expect(find({ status: 'unavailable' })).toEqual([1]);
    expect(find({ status: 'removed' })).toEqual([3]);
    expect(find({ status: 'problem' })).toEqual([1, 3, 4]);
    expect(find({ status: 'web-unavailable' })).toEqual([4]);
    expect(find({ status: 'web-plays' })).toEqual([1]);
  });
  it('finds openings, endings and themes', () => expect(find({ themed: true })).toEqual([1]));
  it('sorts, keeping playlist order for ties and putting unknown lengths last', () => {
    expect(find({ sort: 'short' })).toEqual([1, 0, 4, 2, 3]);
    expect(find({ sort: 'long' })).toEqual([2, 4, 0, 1, 3]);
    expect(find({ sort: 'title' })).toEqual([2, 0, 1, 3, 4]);
    expect(find({ sort: 'artist' })).toEqual([1, 3, 0, 4, 2]);
    expect(find({ sort: 'recent' })).toEqual([4, 3, 2, 1, 0]);
  });
  it('counts active filters', () => {
    expect(activeCount(EMPTY)).toBe(0);
    expect(activeCount({ ...EMPTY, text: 'x', max: '3:00', status: 'ok', sort: 'title' })).toBe(3);
  });
});
