// Checks the WCAG contrast of every text/background pair in src/ui/styles/tokens.css, for light and dark.
// Usage: node scripts/contrast.mjs   (exit code 1 if any pair is below its threshold)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/ui/styles/tokens.css', import.meta.url), 'utf8');

/** Variables of a block: the base :root block, or the dark overrides. */
function vars(selectorStart) {
  const i = css.indexOf(selectorStart);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('\n}', i));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/gu)].map((m) => [m[1], m[2].trim()]));
}
const light = vars(':root {');
const dark = { ...light, ...vars(":root[data-theme='dark']") };

function parse(c) {
  c = c.trim();
  let m = /^#([0-9a-f]{6})$/iu.exec(c);
  if (m) return { rgb: [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/u.exec(c);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`cannot parse ${c}`);
}
const over = (top, under) => ({ rgb: top.rgb.map((v, i) => v * top.a + under.rgb[i] * (1 - top.a)), a: 1 });
const lum = ({ rgb }) => {
  const [r, g, b] = rgb.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

// [text token, background token(s) it sits on, minimum]
const PAIRS = [
  ['fg', ['bg', 'surface-solid'], 4.5],
  ['mut', ['bg', 'surface-solid'], 4.5],
  ['accent-text', ['bg', 'surface-solid'], 4.5],
  ['on-accent', ['grad-a', 'grad-b'], 4.5],
  ['on-danger', ['danger'], 4.5],
  ['warn', ['bg', 'surface-solid'], 4.5],
  ['removed', ['bg', 'surface-solid'], 4.5],
];
// tinted chips: the tint is drawn over the page background
const CHIPS = [['warn', 'warn-soft'], ['removed', 'removed-soft'], ['accent-text', 'accent-soft']];

let bad = 0;
for (const [name, v] of [['light', light], ['dark', dark]]) {
  const bg = parse(v.bg);
  const solid = (t) => over(parse(v[t]), bg);
  const check = (label, fg, back, min) => {
    const r = ratio(fg, back);
    const ok = r >= min;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(5)} ${label.padEnd(34)} ${r.toFixed(2)} (min ${min})`);
  };
  for (const [t, backs, min] of PAIRS) for (const b of backs) check(`${t} on ${b}`, solid(t), solid(b), min);
  for (const [t, s] of CHIPS) check(`${t} on ${s} over bg`, solid(t), over(parse(v[s]), bg), 4.5);
  check('mut on surface over bg', solid('mut'), over(parse(v.surface), bg), 4.5);
  check('fg on glass-strong over bg', solid('fg'), over(parse(v['glass-strong']), bg), 4.5);
}
process.exit(bad ? 1 : 0);
