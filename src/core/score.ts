import { words } from './sanitize';

/** difflib.SequenceMatcher(None, a, b).ratio() without autojunk (our strings are short). */
export function ratio(a: string, b: string): number {
  const A = Array.from(a);
  const B = Array.from(b);
  if (!A.length && !B.length) return 1;
  const b2j = new Map<string, number[]>();
  B.forEach((ch, j) => b2j.set(ch, [...(b2j.get(ch) ?? []), j]));
  let matched = 0;
  const stack: [number, number, number, number][] = [[0, A.length, 0, B.length]];
  while (stack.length) {
    const [alo, ahi, blo, bhi] = stack.pop()!;
    let bi = alo;
    let bj = blo;
    let best = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const next = new Map<number, number>();
      for (const j of b2j.get(A[i]!) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        next.set(j, k);
        if (k > best) {
          bi = i - k + 1;
          bj = j - k + 1;
          best = k;
        }
      }
      j2len = next;
    }
    if (best) {
      matched += best;
      if (alo < bi && blo < bj) stack.push([alo, bi, blo, bj]);
      if (bi + best < ahi && bj + best < bhi) stack.push([bi + best, ahi, bj + best, bhi]);
    }
  }
  return (2 * matched) / (A.length + B.length);
}

/** Lowercase, drop bracketed text and punctuation, collapse spaces (used only for scoring). */
export const normForScore = (s: string | null | undefined): string => words((s ?? '').replace(/[([].*?[)\]]/gu, ' ')).join(' ');

export interface Scorable {
  title: string | null;
  artists: string;
  cleanTitle?: string | null;
  cleanArtist?: string | null;
  duration: number | null;
}

export interface Candidate {
  title: string | null;
  artists: string;
  duration: number | null;
}

/** 0..1 similarity of a search result to a stored item; +0.2 if durations are within 3s. */
export function score(item: Scorable, cand: Candidate): number {
  const a = normForScore(`${item.cleanArtist || item.artists} ${item.cleanTitle || item.title}`);
  const b = normForScore(`${cand.artists} ${cand.title}`);
  let s = ratio(a, b);
  if (item.duration && cand.duration && Math.abs(item.duration - cand.duration) <= 3) s += 0.2;
  return Math.min(s, 1);
}

export const round2 = (x: number): number => Math.round(x * 100) / 100;
