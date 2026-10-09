/**
 * Title cleanup + variant-aware song keys. Pure functions, no I/O.
 *
 * Noise (official video, lyrics, HD...) is the same recording in different packaging, so it is
 * dropped. Anything else in brackets (remix, cover, slowed, unknown...) is a different track, so
 * it is kept as a tag. Unknown means variant: a missed duplicate is cheaper than a wrongly removed track.
 *
 * Matching is Unicode-aware (like Python's \w and \b, which this was ported from); JS's \b is not, so word
 * boundaries are spelled out with lookarounds (WB_START / WB_END).
 */

const W = String.raw`\p{L}\p{N}_`;
const WB_START = String.raw`(?<![${W}])`;
const WB_END = String.raw`(?![${W}])`;

const NOISE = new Set(
  `official music video audio lyric lyrics visualizer visualiser hd hq 4k mv full song
oficial videoclip clip with album version remastered remaster topic`.split(/\s+/),
);
/** Words that mark a different track even when written outside brackets. */
const VARIANT = new Set('remix cover mashup slowed reverb nightcore instrumental acoustic live extended karaoke edit'.split(' '));

const FEAT = new RegExp(String.raw`^(feat|ft|featuring)${WB_END}\.?`, 'iu');
const BRACKET = /\(([^()]*)\)|\[([^[\]]*)\]|【([^】]*)】|「([^」]*)」|『([^』]*)』/gu;
const TRAIL = [
  /[\s\-–—|:]+(official\s+)?(music\s+|lyric\s+)?(video|audio|lyrics?|visualizer)\s*$/iu,
  /\s+official\s+(music\s+|lyric\s+)?(video|audio)\s*$/iu,
];
const FEAT_INLINE = /\s+(feat|ft|featuring)\.?\s+.*$/iu;
const DASH = /\s+[-–—]\s+/u;
const TOPIC = /\s*-\s*topic$|vevo$/iu;
// case-sensitive on purpose (kept from the original Python version): "Lil Nas X" is one name, "A x B" is two
const NAME_SPLIT = new RegExp(String.raw`,|&|${WB_START}x${WB_END}|;|${WB_START}and${WB_END}`, 'u');

/** Python str.strip(chars). */
function strip(s: string, chars: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a]!)) a++;
  while (b > a && chars.includes(s[b - 1]!)) b--;
  return s.slice(a, b);
}

export function words(s: string | null | undefined): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(new RegExp(String.raw`[^${W}\s]`, 'gu'), ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const norm = (s: string | null | undefined): string => words(s).join(' ');

function isNoise(content: string): boolean {
  const w = words(content);
  return w.length > 0 && w.every((x) => NOISE.has(x) || /^\d{4}$/u.test(x));
}

/** Normalised artist names from an "A, B & C" style string; Topic/VEVO suffixes dropped. */
function names(artist: string): Set<string> {
  const a = (artist ?? '').trim().replace(TOPIC, '');
  const out = new Set(a.split(NAME_SPLIT).map(norm).filter(Boolean));
  const whole = norm(a);
  if (whole) out.add(whole);
  return out;
}

const stripSymbols = (s: string): string => s.replace(/[\p{So}\p{Sk}]/gu, '');

export interface Cleaned {
  /** Display title. */
  title: string;
  /** Display artist. */
  artist: string;
  /** Normalised base title used for matching. */
  key: string;
  /** Variant tags (remix, slowed, ...), sorted. */
  tags: string[];
  /** Normalised artist names. */
  names: Set<string>;
}

export function clean(title: string | null | undefined, artist: string | null | undefined): Cleaned {
  const artistStr = artist ?? '';
  let t = stripSymbols(title ?? '');
  const tags = new Set<string>();
  const displayFeats: string[] = [];

  t = t.replace(BRACKET, (...m: unknown[]) => {
    const c = (m.slice(1, 6) as (string | undefined)[]).find((g) => g !== undefined)!.trim();
    if (isNoise(c)) return ' ';
    if (FEAT.test(c)) {
      displayFeats.push(c);
      return ' ';
    }
    tags.add(norm(c));
    return ` (${c}) `;
  });

  const segs = t.split(/\s+\|\s+/u).filter((s) => s.trim() && !isNoise(s) && norm(s) !== norm(artistStr));
  t = segs.length ? segs[0]! : t;
  for (const p of TRAIL) t = t.replace(p, '');
  const m = FEAT_INLINE.exec(t);
  if (m) {
    displayFeats.push(m[0].trim());
    t = t.slice(0, m.index);
  }
  t = strip(t.replace(/\s+/gu, ' '), ' -–—|:');

  const nameSet = names(artistStr);
  const shownArtist = artistStr.trim().replace(TOPIC, '') || artistStr;
  let keyTitle = t;
  const d = DASH.exec(t);
  if (d) {
    const left = t.slice(0, d.index);
    const right = t.slice(d.index + d[0].length);
    const nl = norm(left);
    const joined = norm(artistStr);
    if (nl && (nameSet.has(nl) || joined.includes(nl) || nl.includes(joined))) {
      t = keyTitle = right.trim(); // "Artist - Title" with the artist already known
    } else {
      nameSet.add(nl); // probably the real artist when the uploader is a channel
      keyTitle = right.trim();
    }
  }
  for (const w of words(keyTitle.replace(BRACKET, ' '))) if (VARIANT.has(w)) tags.add(w);

  let shown = t + displayFeats.map((f) => ` (${f})`).join('');
  shown = strip(shown.replace(/\(\s+/gu, '(').replace(/\s+/gu, ' '), ' ');
  return { title: shown || (title ?? ''), artist: shownArtist, key: norm(keyTitle), tags: [...tags].sort(), names: nameSet };
}

/** Two tracks are the same song when key and tags are equal and artist names overlap. */
export function songKey(title: string | null | undefined, artist: string | null | undefined) {
  const c = clean(title, artist);
  return { key: c.key, tags: c.tags, names: c.names };
}

/** Map key for (key, tags) buckets. */
export const bucketKey = (key: string, tags: readonly string[]): string => `${key}\u0000${tags.length}\u0001${tags.join('\u0001')}`; // length: [''] must differ from []

export const namesOverlap = (a: Set<string>, b: Set<string>): boolean => {
  for (const x of a) if (b.has(x)) return true;
  return false;
};

const THEME = new RegExp(
  String.raw`${WB_START}(?:(?:opening|ending|op|ed|intro|outro|theme)(?:\s*(?:no\.?\s*)?\d+)?|tv\s*size|tv\s*ver[${W}]*|` +
    String.raw`non[- ]?credit[${W}]*|season\s*\d+|part\s*\d+|full\s*ver[${W}]*)${WB_END}`,
  'giu',
);
const QUOTED = /「([^」]+)」|『([^』]+)』|“([^”]+)”|"([^"]+)"|‘([^’]+)’/gu;

/**
 * Search strings for finding the full-length song behind a short clip (anime OP/ED, intro, outro).
 * First: song name + show name (best ranked by YouTube Music), then song alone, title without
 * OP/ED words, artist + title.
 */
export function shortQueryVariants(title: string | null | undefined, artist: string | null | undefined, n = 4): string[] {
  const t = title ?? '';
  const quoted: [number, string][] = [];
  for (const m of t.matchAll(QUOTED)) {
    m.slice(1, 6).forEach((g, i) => {
      if (g) quoted.push([i, g]);
    });
  }
  // stable sort: 『』 (group 1) usually holds the show title, so it goes last
  const qs = quoted.map((q, idx) => ({ q, idx })).sort((a, b) => Number(a.q[0] === 1) - Number(b.q[0] === 1) || a.idx - b.idx).map((x) => x.q);
  const out: string[] = qs.map(([, g]) => g);
  const parts = t.split(/\s+\|\s+|\s*│\s*/u).map((p) => p.trim()).filter(Boolean);
  let show: string | null = qs.find(([i]) => i === 1)?.[1] ?? null;
  if (parts.length > 1) {
    out.push(parts[parts.length - 1]!);
    if (!show) {
      // "Show - Opening | Song": the show is whatever is left of the bar
      let left = parts[0]!.replace(THEME, ' ');
      for (const w of words(artist)) left = left.replace(new RegExp(`${WB_START}${w.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}${WB_END}`, 'giu'), ' ');
      show = strip(left.replace(/\s+/gu, ' '), ' -–—|:/') || null;
    }
  }
  const base = clean(out.length ? t.replace(QUOTED, ' ') : t, artist).title;
  const stripped = strip(base.replace(THEME, ' ').replace(/\s+/gu, ' '), ' -–—|:/');
  out.push(stripped, `${clean(t, artist).artist} ${stripped}`.trim());
  if (out.length && show && norm(show) !== norm(out[0])) out.unshift(`${out[0]} ${show}`);
  const seen = new Set<string>();
  const res: string[] = [];
  for (const q0 of out) {
    const q = strip(q0.replace(/\([^)]*\)/gu, ' ').replace(/\s+/gu, ' '), ' -–—|:/');
    if (q && !seen.has(q.toLowerCase()) && !isNoise(q)) {
      seen.add(q.toLowerCase());
      res.push(q);
    }
  }
  return res.slice(0, n);
}
