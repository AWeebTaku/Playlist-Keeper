import { mount } from 'svelte';
import './ui/app.css';
import App from './ui/App.svelte';

if (import.meta.env.DEV) {
  // dev only: send the webview's console and uncaught errors to the terminal running `tauri dev`
  void import('@tauri-apps/plugin-log').then((l) => {
    const send = (level: 'debug' | 'info' | 'warn' | 'error') => (...args: unknown[]) => void l[level](args.map((a) => (a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    for (const [name, level] of [['log', 'info'], ['info', 'info'], ['warn', 'warn'], ['error', 'error'], ['debug', 'debug']] as const) {
      const original = console[name].bind(console);
      const forward = send(level);
      console[name] = (...args: unknown[]) => {
        original(...args);
        forward(...args);
      };
    }
    window.addEventListener('error', (e) => send('error')('uncaught:', e.message, `${e.filename}:${e.lineno}`));
    window.addEventListener('unhandledrejection', (e) => send('error')('unhandled rejection:', e.reason));
  });
  // dev only, for screenshots: VITE_OPEN="<playlist title>" [VITE_TAB=short|compare|clean|dupes] [VITE_VIEW=list|grid|compact|cards] [VITE_THEME=light|dark] [VITE_MENU=1] [VITE_HIDDEN=1] [VITE_FAKEUPDATE=1] [VITE_CONNECT=1]
  if (import.meta.env.VITE_THEME) void import('./ui/store.svelte').then(({ store }) => store.setTheme(import.meta.env.VITE_THEME as 'light' | 'dark' | 'system'));
  if (import.meta.env.VITE_CONNECT) void import('./ui/store.svelte').then(async ({ store }) => {
    while (store.phase === 'boot') await new Promise((r) => setTimeout(r, 200));
    store.phase = 'connect'; // look only: the saved login is untouched
  });
  if (import.meta.env.VITE_MENU || import.meta.env.VITE_HIDDEN || import.meta.env.VITE_FAKEUPDATE) {
    void import('./ui/store.svelte').then(async ({ store }) => {
      while (store.phase !== 'ready') await new Promise((r) => setTimeout(r, 200));
      if (import.meta.env.VITE_HIDDEN) store.showHidden = true;
      if (import.meta.env.VITE_FAKEUPDATE) store.update = { version: '9.9.9', notes: '', install: async () => undefined };
      if (import.meta.env.VITE_MENU) store.profileOpen = true;
    });
  }
  if (import.meta.env.VITE_OPEN) void import('./ui/store.svelte').then(async ({ store }) => {
    while (store.phase !== 'ready') await new Promise((r) => setTimeout(r, 200));
    const p = store.playlists.find((x) => x.title === import.meta.env.VITE_OPEN);
    if (p) await store.select(p.id);
    if (import.meta.env.VITE_VIEW) store.setPlaylistView(import.meta.env.VITE_VIEW as typeof store.playlistView);
    if (import.meta.env.VITE_TAB) store.tab = import.meta.env.VITE_TAB as typeof store.tab;
  });
  if (import.meta.env.VITE_SELFTEST) void import('./dev/selftest').then((m) => m.selftest());
}

mount(App, { target: document.getElementById('app')! });
