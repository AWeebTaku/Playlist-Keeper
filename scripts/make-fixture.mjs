// Turns a raw YouTube Music `browse` response (saved from the browser's dev tools) into a small, privacy-safe test fixture.
//   node scripts/make-fixture.mjs <response.json> <playlist|library> [--max 6]   (writes tests/fixtures/<kind>-page.json)
// Removes tracking and account data, keeps the first N rows (always including one greyed-out track, if there is one),
// and prints a summary. YOU must still read the output: playlist titles, track titles and ids are real and are left as they are.
import { readFileSync, writeFileSync } from 'node:fs';

const DROP = new Set(['responseContext', 'trackingParams', 'clickTrackingParams', 'visitorData', 'loggingDirectives', 'serviceTrackingParams', 'activeAccountHeaderRenderer', 'accountPhoto', 'channelHandle']);
const GREY = 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT';

const isRow = (x) => x && typeof x === 'object' && ('musicResponsiveListItemRenderer' in x || 'musicTwoRowItemRenderer' in x);

/** Keep `max` rows of a list of rows; a greyed-out track is kept even when it is further down. */
function trimRows(rows, max) {
  const keep = rows.slice(0, max);
  const grey = rows.find((r) => r.musicResponsiveListItemRenderer?.musicItemRendererDisplayPolicy === GREY);
  if (grey && !keep.includes(grey)) keep[keep.length - 1] = grey;
  return keep;
}

/** A copy of `node` without tracking/account keys and with every list of rows cut to `max` rows. Pure. */
export function sanitize(node, max = 6) {
  if (Array.isArray(node)) {
    const items = node.map((x) => sanitize(x, max));
    return items.length > max && items.some(isRow) ? trimRows(items, max) : items;
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).filter(([k]) => !DROP.has(k)).map(([k, v]) => [k, sanitize(v, max)]));
  }
  return node;
}

/** How many rows a sanitized page holds, for the summary. */
export function countRows(node) {
  if (Array.isArray(node)) return node.reduce((n, x) => n + countRows(x), 0);
  if (node && typeof node === 'object') return ('musicResponsiveListItemRenderer' in node || 'musicTwoRowItemRenderer' in node ? 1 : 0) + Object.values(node).reduce((n, x) => n + countRows(x), 0);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, kind, ...rest] = process.argv.slice(2);
  const maxAt = rest.indexOf('--max');
  const max = maxAt >= 0 ? Number(rest[maxAt + 1]) : 6;
  if (!file || !['playlist', 'library'].includes(kind) || !Number.isInteger(max) || max < 1) {
    console.error('usage: node scripts/make-fixture.mjs <response.json> <playlist|library> [--max 6]');
    process.exit(2);
  }
  const out = sanitize(JSON.parse(readFileSync(file, 'utf8')), max);
  const target = new URL(`../tests/fixtures/${kind}-page.json`, import.meta.url);
  writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote tests/fixtures/${kind}-page.json with ${countRows(out)} rows. Read it now and replace anything personal, then run: npm test`);
}
