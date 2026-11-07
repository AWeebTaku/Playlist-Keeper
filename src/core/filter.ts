/** Search, filter and sort for the tracks of one playlist. Pure. */

export interface FilterItem {
  title: string | null;
  cleanTitle: string | null;
  artists: string;
  cleanArtist: string | null;
  album: string | null;
  duration: number | null;
  status: string;
  ytStatus: string | null;
  position: number;
  firstSeen: number;
}

export type StatusFilter = 'all' | 'ok' | 'problem' | 'unavailable' | 'removed' | 'web-unavailable' | 'web-plays';
export type Sort = 'playlist' | 'title' | 'artist' | 'short' | 'long' | 'recent';

export interface Criteria {
  /** Words that must all appear in the title, artist or album. "quoted phrase" matches as written, -word must not appear. */
  text: string;
  title: string;
  artist: string;
  album: string;
  /** Length bounds as typed ("2:30", "1:02:03" or seconds); blank means no bound. */
  min: string;
  max: string;
  status: StatusFilter;
  /** Openings, endings, intros, outros and themes. */
  themed: boolean;
  sort: Sort;
}

export const EMPTY: Criteria = { text: '', title: '', artist: '', album: '', min: '', max: '', status: 'all', themed: false, sort: 'playlist' };

const THEMED = /opening|ending|\bop\s*\d*\b|\bed\s*\d*\b|intro|outro|theme|tv size|オープニング|エンディング|主題歌/iu;

/** Lower case without accents, so "Beyonce" finds "Beyoncé". */
const fold = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

/** "2:30", "1:02:03" or "150" (seconds) to seconds. Blank or unreadable gives null. */
export function parseLength(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/u.test(t)) return null;
  return t.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** True when a length box holds something that is not a length (so the UI can say so). */
export const badLength = (text: string) => text.trim() !== '' && parseLength(text) === null;

interface Term {
  text: string;
  not: boolean;
}

function terms(query: string): Term[] {
  const out: Term[] = [];
  for (const m of query.matchAll(/(-?)"([^"]+)"|(-?)(\S+)/gu)) {
    const not = (m[1] ?? m[3]) === '-';
    const text = fold(m[2] ?? m[4]).trim();
    if (text) out.push({ text, not });
  }
  return out;
}

const has = (hay: string, needle: string) => hay.includes(needle);

/** How many filters are switched on (the sort is not a filter). */
export function activeCount(c: Criteria): number {
  return [c.text.trim(), c.title.trim(), c.artist.trim(), c.album.trim(), c.min.trim(), c.max.trim(), c.status !== 'all', c.themed].filter(Boolean).length;
}

function statusOk(i: FilterItem, s: StatusFilter): boolean {
  switch (s) {
    case 'all':
      return true;
    case 'ok':
      return i.status === 'ok';
    case 'problem':
      return i.status === 'unavailable' || i.status === 'removed' || i.ytStatus === 'unavailable';
    case 'unavailable':
      return i.status === 'unavailable';
    case 'removed':
      return i.status === 'removed';
    case 'web-unavailable':
      return i.ytStatus === 'unavailable';
    case 'web-plays':
      return i.status === 'unavailable' && i.ytStatus === 'ok';
  }
}

const bySort: Record<Sort, (a: FilterItem, b: FilterItem) => number> = {
  playlist: (a, b) => a.position - b.position,
  title: (a, b) => fold(a.cleanTitle || a.title).localeCompare(fold(b.cleanTitle || b.title)),
  artist: (a, b) => fold(a.cleanArtist || a.artists).localeCompare(fold(b.cleanArtist || b.artists)),
  short: (a, b) => (a.duration ?? Infinity) - (b.duration ?? Infinity),
  long: (a, b) => (b.duration ?? -Infinity) - (a.duration ?? -Infinity),
  recent: (a, b) => b.firstSeen - a.firstSeen,
};

/** The items that match every filter, in the chosen order (ties keep playlist order). */
export function applyFilter<T extends FilterItem>(items: T[], c: Criteria): T[] {
  const all = terms(c.text);
  const title = fold(c.title).trim();
  const artist = fold(c.artist).trim();
  const album = fold(c.album).trim();
  const min = parseLength(c.min);
  const max = parseLength(c.max);
  const kept = items.filter((i) => {
    const t = `${fold(i.title)} ${fold(i.cleanTitle)}`;
    const a = `${fold(i.artists)} ${fold(i.cleanArtist)}`;
    const al = fold(i.album);
    if (title && !has(t, title)) return false;
    if (artist && !has(a, artist)) return false;
    if (album && !has(al, album)) return false;
    const hay = `${t} ${a} ${al}`;
    if (!all.every((x) => has(hay, x.text) !== x.not)) return false;
    if ((min !== null || max !== null) && i.duration === null) return false;
    if (min !== null && i.duration! < min) return false;
    if (max !== null && i.duration! > max) return false;
    if (c.themed && !THEMED.test(`${i.title ?? ''} ${i.cleanTitle ?? ''}`)) return false;
    return statusOk(i, c.status);
  });
  return c.sort === 'playlist' ? kept.sort(bySort.playlist) : kept.sort((x, y) => bySort[c.sort](x, y) || x.position - y.position);
}
