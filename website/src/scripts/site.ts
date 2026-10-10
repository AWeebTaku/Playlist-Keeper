import { detectOs, pickAssets, primaryKey, type Os } from '../lib/pick';

const API = 'https://api.github.com/repos/AWeebTaku/Playlist-Keeper';
const $ = <T extends Element>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAMES: Record<Os, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
const SUBS: Record<Os, string> = { windows: 'Installer (.exe), 64-bit', macos: 'Universal disk image (.dmg)', linux: 'AppImage, also .deb, .rpm and Arch' };

/* theme: system by default, toggle remembers the choice; the change plays as a circular reveal where supported */
function applyTheme(next: 'light' | 'dark') {
  root.dataset.theme = next;
  root.dataset.resolved = next;
  try { localStorage.setItem('pk-theme', next); } catch { /* private mode: the choice just is not remembered */ }
}
$('#theme').forEach((b) =>
  b.addEventListener('click', (e) => {
    const next = root.dataset.resolved === 'dark' ? 'light' : 'dark';
    const r = (b as HTMLElement).getBoundingClientRect();
    root.style.setProperty('--tx', `${r.left + r.width / 2}px`);
    root.style.setProperty('--ty', `${r.top + r.height / 2}px`);
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !reduced && (e as MouseEvent).detail >= 0) doc.startViewTransition(() => applyTheme(next));
    else applyTheme(next);
  }),
);
matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  if (!root.dataset.theme) root.dataset.resolved = e.matches ? 'light' : 'dark';
});

/* nav gets its frosted background after the first scroll; current section is highlighted */
const nav = $('#nav')[0];
const onScroll = () => nav?.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
const links = $<HTMLAnchorElement>('.links a');
const spy = new IntersectionObserver(
  (es) => es.forEach((e) => e.isIntersecting && links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${e.target.id}`))),
  { rootMargin: '-45% 0px -50% 0px' },
);
$('main section[id]').forEach((s) => spy.observe(s));

/* scroll reveal */
const io = new IntersectionObserver(
  (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
  { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
);
$('.reveal').forEach((el) => io.observe(el));

/* cursor spotlight on cards */
$<HTMLElement>('.card').forEach((c) =>
  c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }),
);

/* hero window tilts toward the pointer */
const stage = $<HTMLElement>('#stage')[0];
const tilt = $<HTMLElement>('#tilt')[0];
if (stage && tilt && !reduced && matchMedia('(hover: hover)').matches) {
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.setProperty('--ry', `${x * 7}deg`);
    tilt.style.setProperty('--rx', `${3 - y * 6}deg`);
  });
  stage.addEventListener('pointerleave', () => { tilt.style.removeProperty('--ry'); tilt.style.removeProperty('--rx'); });
}

/* tab groups (screenshots, operating systems) */
function tabs(group: string, attr: string, show: (v: string) => void) {
  const btns = $<HTMLButtonElement>(`${group} button`);
  const select = (v: string) => { btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset[attr] === v))); show(v); };
  btns.forEach((b) => b.addEventListener('click', () => select(b.dataset[attr] ?? '')));
  btns.forEach((b, i) => b.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = btns[(i + d + btns.length) % btns.length];
    n?.focus();
    n?.click();
  }));
  return select;
}
const CAPS: Record<string, string> = {
  home: 'The Home page lists the playlists that need attention first.',
  items: 'Every track, with its status and a one-click "Find replacement".',
  short: 'Clips that are a cut of a longer song, with the full version one click away.',
};
tabs('#shots-tabs', 'pane', (v) => {
  $('.gallery .pane').forEach((p) => p.classList.toggle('on', p.id === `pane-${v}`));
  const cap = $('#cap')[0];
  if (cap) cap.textContent = CAPS[v] ?? '';
});
const selectOs = tabs('#os-tabs', 'os', (v) => $('.panel').forEach((p) => p.classList.toggle('on', p.id === `os-${v}`)));

/* download buttons: detect the system, then resolve real file links from the latest release */
const os = detectOs(navigator.userAgent, (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform);
selectOs(os ?? 'windows');
if (os) {
  $('[data-os-label]').forEach((e) => (e.textContent = `Download for ${NAMES[os]}`));
  $('[data-os-sub]').forEach((e) => (e.textContent = SUBS[os]));
}
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
function show(release: { tag_name: string; assets: { name: string; browser_download_url: string }[] }, stars: number | null) {
  const links = pickAssets(release.assets);
  $<HTMLAnchorElement>('[data-asset]').forEach((a) => {
    const key = a.dataset.asset === 'main' ? (os ? primaryKey(os) : null) : (a.dataset.asset as keyof typeof links);
    const url = key ? links[key] : undefined;
    if (url) a.href = url;
  });
  $('[data-version]').forEach((e) => (e.textContent = release.tag_name));
  $('[data-version-h]').forEach((e) => (e.textContent = release.tag_name));
  $('[data-version-text]').forEach((e) => (e.textContent = `${release.tag_name} is out`));
  if (stars !== null) $('[data-stars]').forEach((e) => (e.textContent = fmt(stars)));
}
async function load() {
  try {
    const cached = sessionStorage.getItem('pk-rel');
    if (cached) {
      const c = JSON.parse(cached) as { at: number; release: Parameters<typeof show>[0]; stars: number | null };
      if (Date.now() - c.at < 600_000) return show(c.release, c.stars);
    }
  } catch { /* no cache: fetch */ }
  try {
    const [r, repo] = await Promise.all([fetch(`${API}/releases/latest`), fetch(API)]);
    if (!r.ok) return; // rate limited or offline: the buttons keep pointing at the releases page
    const release = await r.json();
    const stars = repo.ok ? ((await repo.json()) as { stargazers_count: number }).stargazers_count : null;
    show(release, stars);
    try { sessionStorage.setItem('pk-rel', JSON.stringify({ at: Date.now(), release, stars })); } catch { /* ignore */ }
  } catch { /* offline */ }
}
void load();

/* copy buttons */
$<HTMLButtonElement>('.copy').forEach((b) =>
  b.addEventListener('click', async () => {
    const text = document.getElementById(b.dataset.copy ?? '')?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(text);
      const old = b.innerHTML;
      b.classList.add('done');
      b.textContent = 'Copied';
      setTimeout(() => { b.classList.remove('done'); b.innerHTML = old; }, 1600);
    } catch { /* clipboard blocked: the command stays selectable */ }
  }),
);
