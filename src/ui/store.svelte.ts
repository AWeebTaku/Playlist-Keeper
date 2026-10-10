import type { ItemRow, PlaylistRow } from '../services/db';
import { getVersion } from '@tauri-apps/api/app';
import type { Profile } from '../services/parse';
import { client, openRepo, restoreSession, runSync, setClient, signOut } from '../services/app';
import type { Repo } from '../services/db';
import { refreshLibrary, type YtClient } from '../services/actions';
import { AuthError, messageOf } from '../services/errors';
import { checkForUpdate, openReleasesPage, updateHow, type Available } from '../services/updater';
import { updateSupport, type UpdateSupport } from '../services/tauri';
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

export type PlaylistView = 'list' | 'grid' | 'compact' | 'cards';
const PLAYLIST_VIEWS: PlaylistView[] = ['list', 'grid', 'compact', 'cards'];

/** The cached profile (name, handle, photo URL): not a secret, kept so the avatar shows instantly. */
function readProfile(): Profile | null {
  try {
    const p = JSON.parse(get('profile') ?? 'null') as Profile | null;
    return p?.name ? p : null;
  } catch {
    return null;
  }
}

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
  playlistView = $state<PlaylistView>(PLAYLIST_VIEWS.includes(get('plview') as PlaylistView) ? (get('plview') as PlaylistView) : 'list');
  collapsed = $state({ playlists: get('c-playlists') === '1', hidden: get('c-hidden') === '1' });
  profile = $state<Profile | null>(readProfile());
  profileOpen = $state(false);
  /** True when the Connect screen was opened by Reconnect and a working login still exists (so Back is offered). */
  canGoBack = $state(false);
  appVersion = $state('');

  private toastId = 0;

  update = $state<Available | null>(null);
  /** Whether this install can update itself (false for e.g. the Arch package) and where to get a new package instead. */
  updates = $state<UpdateSupport>({ supported: true, reason: null, releasesUrl: null, os: '', bundle: null });
  /** The last manual check found nothing newer. */
  upToDate = $state(false);
  aboutOpen = $state(false);
  /** Project page: the website is not built yet. */
  readonly website: string | null = null;
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
    this.upToDate = false;
    try {
      this.update = await checkForUpdate();
      this.upToDate = !this.update;
      if (this.update && !quiet && this.updates.releasesUrl && (await this.ask(`Version ${this.update.version} is available`, `${updateHow(this.updates)}\n\nOpen the release page on GitHub to see what is new and download it?`, 'Open GitHub'))) this.openReleases();
    } catch (e) {
      if (!quiet) this.toast(`Could not reach the update server (${messageOf(e)}). Releases are listed on GitHub.`, true);
    } finally {
      this.updateState = 'idle';
    }
  }

  openReleases() {
    this.openLink(this.updates.releasesUrl);
  }

  openLink(url: string | null) {
    if (url) void openReleasesPage(url).catch(() => undefined);
  }

  /** The GitHub project page (the releases URL without its /releases/... tail). */
  get repoUrl() {
    return this.updates.releasesUrl?.replace(/\/releases(\/.*)?$/u, '') ?? null;
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

  setPlaylistView(v: PlaylistView) {
    this.playlistView = v;
    put('plview', v);
  }

  toggleSection(s: 'playlists' | 'hidden') {
    this.collapsed[s] = !this.collapsed[s];
    put(`c-${s}`, this.collapsed[s] ? '1' : '0');
  }

  /** Refresh name and photo of the signed-in account; the cached copy stays if YouTube does not answer. */
  async loadProfile() {
    try {
      const p = await client().profile();
      if (p) {
        this.profile = p;
        put('profile', JSON.stringify(p));
      }
    } catch {
      /* the avatar falls back to the cached profile or an initial */
    }
  }

  setView(v: 'list' | 'grid') {
    this.view = v;
    put('view', v);
  }

  async boot() {
    if (this.theme !== 'system') document.documentElement.dataset.theme = this.theme;
    if (import.meta.env.DEV && location.search.includes('mock=1')) {
      // look-and-feel harness with fake data (see src/dev/mock.ts); never used in release builds
      const { applyMock } = await import('../dev/mock');
      applyMock(this, new URLSearchParams(location.search));
      return;
    }
    try {
      await this.reload();
      this.phase = (await restoreSession()) ? 'ready' : 'connect';
      void getVersion().then((v) => (this.appVersion = v)).catch(() => undefined);
      void updateSupport().then((u) => (this.updates = u)).catch(() => undefined);
      if (this.phase === 'ready') {
        void this.loadProfile();
        void this.refreshCovers();
      }
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
    this.canGoBack = false;
    await this.reload();
    void this.loadProfile();
    void this.refreshCovers();
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
  /** Show the Connect screen without touching the current login; Back returns to the app. */
  reconnect() {
    this.profileOpen = false;
    this.connectError = '';
    this.canGoBack = true;
  }

  cancelReconnect() {
    this.connectError = '';
    this.canGoBack = false;
  }

  /** Remove the saved login and show the Connect screen. The saved playlist history stays on this computer. */
  async logout() {
    if (!(await this.ask('Log out?', 'Your saved playlist history stays on this computer. You will need to sign in again.', 'Log out'))) return;
    await signOut();
    this.profileOpen = false;
    this.profile = null;
    put('profile', 'null');
    this.update = null;
    this.selected = null;
    this.items = [];
    this.canGoBack = false;
    this.connectError = '';
    this.phase = 'connect';
    this.toast('Logged out');
  }

  goHome() {
    this.selected = null;
    this.items = [];
    this.profileOpen = false;
  }

  /** Fetch the library list (titles and covers) without reading any tracks. A signed-out answer sends the user to Connect. */
  async refreshCovers() {
    try {
      await refreshLibrary(await openRepo(), client());
      await this.reload();
    } catch (e) {
      if (e instanceof AuthError) {
        this.connectError = e.message;
        this.phase = 'connect';
      } /* offline or a hiccup: the saved covers stay */
    }
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
