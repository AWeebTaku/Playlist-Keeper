import type { ItemRow, PlaylistRow } from '../services/db';
import { client, openRepo, restoreSession, runSync, setClient, signOut } from '../services/app';
import type { Repo } from '../services/db';
import type { YtClient } from '../services/actions';
import { AuthError, messageOf } from '../services/errors';
import { checkForUpdate, type Available } from '../services/updater';
import { signInWithBrowserCookies, signInWithPastedCookie } from '../services/auth';

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const put = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: preferences just are not remembered */
  }
};

class Store {
  phase = $state<'boot' | 'connect' | 'ready'>('boot');
  connectError = $state('');
  busy = $state(false);

  playlists = $state<PlaylistRow[]>([]);
  selected = $state<string | null>(null);
  items = $state<ItemRow[]>([]);
  loadingItems = $state(false);
  showHidden = $state(false);
  query = $state('');

  sync = $state({ running: false, done: 0, total: 0, active: [] as string[], note: '' });
  toasts = $state<{ id: number; text: string; bad: boolean }[]>([]);
  theme = $state<'system' | 'light' | 'dark'>((get('theme') as 'light' | 'dark' | null) ?? 'system');
  view = $state<'list' | 'grid'>(get('view') === 'grid' ? 'grid' : 'list');

  private toastId = 0;

  update = $state<Available | null>(null);
  updateState = $state<'idle' | 'checking' | 'installing'>('idle');
  updatePct = $state<number | null>(null);

  tab = $state<'items' | 'short' | 'compare' | 'clean' | 'dupes'>('items');
  dialog = $state<{ title: string; body: string; ok: string; danger: boolean; resolve: (v: boolean) => void } | null>(null);

  toast(text: string, bad = false) {
    const id = ++this.toastId;
    this.toasts.push({ id, text, bad });
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), bad ? 7000 : 4000);
  }

  /** Confirmation dialog. Resolves true when the user confirms. */
  ask(title: string, body: string, ok = 'Confirm', danger = false): Promise<boolean> {
    return new Promise((resolve) => (this.dialog = { title, body, ok, danger, resolve }));
  }
  answer(v: boolean) {
    this.dialog?.resolve(v);
    this.dialog = null;
  }

  /** Repo and YouTube client for the screens. */
  async ctx(): Promise<{ repo: Repo; yt: YtClient }> {
    return { repo: await openRepo(), yt: client() };
  }

  /** Run something that talks to YouTube: errors become toasts, a signed-out error goes back to Connect. */
  async attempt<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof AuthError) {
        this.connectError = e.message;
        this.phase = 'connect';
      } else this.toast(messageOf(e), true);
      return undefined;
    }
  }

  /** Reload playlist counts and the open playlist after something changed. */
  async refresh() {
    await this.reload();
    if (this.selected) await this.select(this.selected);
  }

  /** Look for a newer release. `quiet` hides "up to date" and network errors (the automatic check at start). */
  async checkUpdate(quiet = false) {
    if (this.updateState !== 'idle') return;
    this.updateState = 'checking';
    try {
      this.update = await checkForUpdate();
      if (!this.update && !quiet) this.toast('You are on the latest version.');
    } catch (e) {
      if (!quiet) this.toast(`Could not check for updates: ${messageOf(e)}`, true);
    } finally {
      this.updateState = 'idle';
    }
  }

  async installUpdate() {
    if (!this.update) return;
    this.updateState = 'installing';
    this.updatePct = null;
    try {
      await this.update.install((p) => (this.updatePct = p)); // restarts the app when done
    } catch (e) {
      this.toast(`Update failed: ${messageOf(e)}`, true);
      this.updateState = 'idle';
    }
  }

  setTheme(t: 'system' | 'light' | 'dark') {
    this.theme = t;
    put('theme', t);
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  setView(v: 'list' | 'grid') {
    this.view = v;
    put('view', v);
  }

  async boot() {
    if (this.theme !== 'system') document.documentElement.dataset.theme = this.theme;
    try {
      await this.reload();
      this.phase = (await restoreSession()) ? 'ready' : 'connect';
      if (import.meta.env.PROD) void this.checkUpdate(true); // release builds only
    } catch (e) {
      this.phase = 'connect';
      this.connectError = e instanceof AuthError ? e.message : '';
    }
  }

  async reload() {
    this.playlists = await (await openRepo()).playlists();
  }

  private async finishConnect(client: Parameters<typeof setClient>[0]) {
    setClient(client);
    this.connectError = '';
    this.phase = 'ready';
    await this.reload();
  }

  /** Run a sign-in route, showing the error on the Connect screen if it fails. */
  async connect(route: () => Promise<Parameters<typeof setClient>[0]>) {
    this.busy = true;
    this.connectError = '';
    try {
      await this.finishConnect(await route());
    } catch (e) {
      this.connectError = messageOf(e);
    } finally {
      this.busy = false;
    }
  }

  signInBrowser(browser: string, profile?: string) {
    return this.connect(() => signInWithBrowserCookies(browser, profile));
  }
  signInPasted(text: string) {
    return this.connect(() => signInWithPastedCookie(text));
  }
  async reconnect() {
    await signOut();
    this.phase = 'connect';
  }

  async select(id: string) {
    this.selected = id;
    this.loadingItems = true;
    try {
      this.items = await (await openRepo()).items(id);
    } finally {
      this.loadingItems = false;
    }
  }

  async toggleHidden(p: PlaylistRow) {
    await (await openRepo()).setHidden(p.id, !p.hidden);
    await this.reload();
    if (this.selected === p.id && !this.showHidden && !p.hidden) {
      this.selected = null;
      this.items = [];
    }
  }

  async runSync() {
    if (this.sync.running) return;
    this.sync = { running: true, done: 0, total: 0, active: [], note: '' };
    try {
      const r = await runSync((p) => (this.sync = { ...this.sync, done: p.done, total: p.total, active: p.active }));
      this.sync.note = `Synced ${r.synced}` + (r.skipped.length ? `, skipped ${r.skipped.length}: ${r.skipped.map((s) => s.title).join(', ')}` : '');
      await this.refresh();
    } catch (e) {
      if (e instanceof AuthError) {
        this.connectError = e.message;
        this.phase = 'connect';
      } else {
        this.sync.note = messageOf(e);
        this.toast(messageOf(e), true);
      }
    } finally {
      this.sync.running = false;
    }
  }
}

export const store = new Store();
