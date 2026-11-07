/**
 * Dev-only look-and-feel harness: open the plain Vite page with ?mock=1 and the store is filled with FAKE data
 * (no Tauri, no network, no personal data) so every screen can be rendered in headless Chrome.
 *   ?mock=1&theme=dark|light&view=list|grid|compact|cards&tracks=list|grid&open=<playlist title>&tab=items|clean|dupes
 *   &menu=1&confirm=1&ddopen=1&hidden=1&screen=home|connect|connect-back&empty=1&about=1&combine=1&combinepick=1&compare=1&sbs=1&tasks=1&tasksopen=1&big=1
 * Compiled out of release builds (only imported under import.meta.env.DEV).
 */
import type { YtClient } from '../services/actions';
import type { ItemRow, PlaylistRow, Repo } from '../services/db';
import type { store as Store } from '../ui/state/store.svelte';
import { tasks } from '../ui/state/tasks.svelte';

const cover = (h1: number, h2: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 60% 42%)"/><stop offset="1" stop-color="hsl(${h2} 65% 30%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="68" cy="34" r="16" fill="rgb(255 255 255 / .18)"/></svg>`)}`;

const NOW = Date.now() / 1000;
const list = (id: string, title: string, total: number, missing: number, hours: number, hue: number, hidden = false): PlaylistRow => ({
  id, title, hidden, total, missing, lastSync: hours < 0 ? null : NOW - hours * 3600, thumb: cover(hue, hue + 50), coverVideo: null,
});

const TITLES = [
  ['Midnight Drive', 'Neon Harbor'], ['Paper Planes (Official Video)', 'Juno Park'], ['Blue Hour (Lyrics)', 'Marlow'], ['Static Bloom', 'Cedar & Pine'],
  ['Opening 2 - Sunrise Parade', 'Crunchyroll'], ['Glass Houses (Slowed + Reverb)', 'Orla Vance'], ['Northern Lights', 'The Lanterns'], ['Run It Back', 'Kito'],
  ['Summer Static (Remix)', 'Daybreak'], ['Quiet Rooms', 'Elm Street'], ['Ending 1 - Last Train', 'Crunchyroll'], ['Afterglow', 'Marlow'],
];
function items(playlistId: string, n: number): ItemRow[] {
  return Array.from({ length: n }, (_, i) => {
    const [title, artists] = TITLES[i % TITLES.length] as [string, string];
    const status = i % 9 === 4 ? 'unavailable' : i % 13 === 7 ? 'removed' : 'ok';
    const clean = title.replace(/ \((Official Video|Lyrics)\)/u, '');
    return {
      playlistId, videoId: `mockvid${String(i).padStart(4, '0')}`, title, artists, album: null,
      duration: i % 11 === 4 ? 84 : 150 + ((i * 37) % 160), setVideoId: `s${i}`, position: i, firstSeen: NOW, lastSeen: NOW, status, ytStatus: status === 'unavailable' ? (i % 2 ? 'ok' : 'unavailable') : 'ok',
      cleanTitle: clean, cleanArtist: artists, tags: /remix|slowed/iu.test(title) ? 'remix' : '',
    } satisfies ItemRow;
  });
}

export function applyMock(store: typeof Store, q: URLSearchParams): void {
  const empty = q.has('empty');
  store.profile = { name: 'Alex Rivera', handle: '@alexrivera', photo: null };
  store.appVersion = '0.1.0';
  store.playlists = empty
    ? []
    : [
        list('p1', 'Late Night Drive', 4962, 92, 2, 350),
        list('p2', 'Anime Openings and Endings', 1602, 36, 2, 20),
        list('p3', 'Focus', 346, 0, 26, 190),
        list('p4', 'Workout Mix', 812, 7, 5, 120),
        list('p5', 'Road Trip 2024', 97, 0, 70, 280),
        list('h1', '2024 Recap', 100, 0, 70, 40, true),
        list('h2', 'Replay Mix', 50, 1, -1, 300, true),
        list('h3', 'Archive Mix', 50, 0, 70, 160, true),
      ];
  if (q.has('theme')) store.setTheme(q.get('theme') as 'light' | 'dark');
  if (q.has('view')) store.setPlaylistView(q.get('view') as typeof store.playlistView);
  if (q.has('tracks')) store.setView(q.get('tracks') as 'list' | 'grid');
  if (q.has('hidden')) store.showHidden = true;
  if (q.has('update')) store.update = { version: '0.2.0', notes: '', install: async () => undefined };
  store.phase = 'ready';
  const open = q.get('open');
  const p = open ? store.playlists.find((x) => x.title === open) : undefined;
  if (p) {
    store.selected = p.id;
    store.items = items(p.id, q.has('big') ? 5000 : 40);
    if (q.has('tab')) store.tab = q.get('tab') as typeof store.tab;
  }
  if (q.has('sbs')) {
    // two saved playlists that differ the way a combined playlist does: some songs missing, one extra near the top
    const a = items('p1', q.has('big') ? 5000 : 60);
    const b = a.filter((_, i) => i % 17 !== 5).map((x) => ({ ...x, playlistId: 'p2' }));
    b.splice(3, 0, { ...a[0]!, videoId: 'extra00001', title: 'Brand New Track', artists: 'Newcomer', cleanTitle: 'Brand New Track', cleanArtist: 'Newcomer', playlistId: 'p2' });
    store.ctx = async () => ({ repo: { items: async (id: string) => (id === 'p1' ? a : b) } as unknown as Repo, yt: {} as YtClient });
  }
  if (q.has('menu')) store.profileOpen = true;
  if (q.has('confirm')) void store.ask('Remove 3 entries?', 'From "Late Night Drive" on YouTube:\n\nNeon Harbor - Midnight Drive\nJuno Park - Paper Planes\n\nThis cannot be undone from here.', 'Remove', true);
  const screen = q.get('screen');
  if (q.has('about')) store.aboutOpen = true;
  if (q.has('combine')) store.openCombine();
  if (q.has('combinepick')) void import('../ui/pages/combineFlow.svelte').then(({ flow }) => (flow.picked = ['p1', 'p5', 'p3']));
  if (q.has('compare')) store.openCompare();
  if (q.has('tasks')) {
    const run = tasks.start({ title: 'Creating "Road trip, all together"', open: () => store.openCombine(), total: 4200 });
    tasks.patch(run, { done: 1700, detail: '1,700 of 4,200 songs copied' });
    const ok = tasks.start({ title: 'Syncing playlists', open: () => store.goHome() });
    tasks.finish(ok, 'done', 'Synced 5');
    const bad = tasks.start({ title: 'Reading playlists to combine', open: () => store.openCombine() });
    tasks.finish(bad, 'failed', 'Could not read the playlists');
  }
  if (screen === 'connect' || screen === 'connect-back') {
    store.canGoBack = screen === 'connect-back';
    store.phase = screen === 'connect' ? 'connect' : 'ready';
  }
}
