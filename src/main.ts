import { mount } from 'svelte';
import './ui/app.css';
import App from './ui/App.svelte';

if (import.meta.env.DEV) {
  void import('@tauri-apps/plugin-log').then((l) => l.attachConsole());
  // dev only: VITE_OPEN="<playlist title>" [VITE_TAB=short|compare|clean|dupes] opens that view on start (handy for screenshots)
  if (import.meta.env.VITE_OPEN) void import('./ui/store.svelte').then(async ({ store }) => {
    while (store.phase !== 'ready') await new Promise((r) => setTimeout(r, 200));
    const p = store.playlists.find((x) => x.title === import.meta.env.VITE_OPEN);
    if (p) await store.select(p.id);
    if (import.meta.env.VITE_TAB) store.tab = import.meta.env.VITE_TAB as typeof store.tab;
  });
  if (import.meta.env.VITE_SELFTEST) void import('./dev/selftest').then((m) => m.selftest());
}

mount(App, { target: document.getElementById('app')! });
