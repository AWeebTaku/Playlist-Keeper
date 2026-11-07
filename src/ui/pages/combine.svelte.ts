/**
 * The Combine wizard's state and actions. It lives here rather than in the page so a run keeps going, and the page shows the
 * right step again, when the user goes elsewhere and comes back (the top-bar indicator brings them back).
 */
import { PLAYLIST_LIMIT, partTitles, planCombine, splitParts, type Order, type Plan } from '../../core/combine';
import { loadSources, newRun, runCombine, type CombineRun, type PartResult } from '../../services/combine';
import { store } from '../state/store.svelte';
import { tasks } from '../state/tasks.svelte';
import { coverUrls } from '../state/util';

interface Row {
  id: string;
  title: string;
  total: number;
  unavailable: number;
  covers: string[];
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

class CombineFlow {
  step = $state<'pick' | 'review' | 'run'>('pick');
  picked = $state<string[]>([]);
  order = $state<Order>('playlist');
  likely = $state(true);
  query = $state('');
  name = $state('');
  partNames = $state<string[]>([]);
  reading = $state({ done: 0, total: 0 });
  plan = $state<Plan | null>(null);
  run = $state<CombineRun | null>(null);
  progress = $state({ done: 0, total: 0 });
  working = $state(false);
  failure = $state('');
  results = $state<PartResult[] | null>(null);

  get rows(): Row[] {
    return [
      ...store.playlists.filter((p) => !p.hidden && p.total > 0).map((p) => ({ id: p.id, title: p.title, total: p.total, unavailable: p.missing, covers: coverUrls(p) })),
    ];
  }
  get chosen(): Row[] {
    const by = new Map(this.rows.map((r) => [r.id, r]));
    return this.picked.map((id) => by.get(id)).filter((r): r is Row => !!r);
  }
  get parts() {
    return this.plan ? splitParts(this.plan.tracks) : [];
  }
  get titles() {
    const base = partTitles(this.name.trim() || 'Combined', this.parts.length);
    return this.parts.map((_, i) => this.partNames[i]?.trim() || base[i]!);
  }

  toggle = (id: string) => (this.picked = this.picked.includes(id) ? this.picked.filter((x) => x !== id) : [...this.picked, id]);

  move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= this.picked.length) return;
    const next = [...this.picked];
    [next[i], next[j]] = [next[j]!, next[i]!];
    this.picked = next;
  };

  /** Read the chosen playlists fresh (this is also where youtube.com availability is checked), then build the plan. */
  review = async () => {
    this.working = true;
    this.failure = '';
    this.step = 'review';
    this.plan = null;
    const chosen = this.chosen;
    this.reading = { done: 0, total: chosen.length };
    const task = tasks.start({ title: 'Reading playlists to combine', total: chosen.length, open: () => store.openCombine() });
    const { repo, yt } = await store.ctx();
    const read = await store.attempt(() =>
      loadSources(repo, yt, chosen.map((p) => ({ id: p.id, title: p.title })), (done, total) => {
        this.reading = { done, total };
        tasks.patch(task, { done, total, detail: `${done} of ${total} playlists read` });
      }),
    );
    this.working = false;
    if (!read) {
      this.step = 'pick';
      tasks.finish(task, 'failed', 'Could not read the playlists');
      return;
    }
    this.plan = planCombine(read, { order: this.order, likely: this.likely });
    this.partNames = [];
    tasks.finish(task, 'done', `${this.plan.tracks.length.toLocaleString()} songs ready to copy`);
    store.toast('Playlists read. Review and name the new playlist.');
    await store.reload();
  };

  start = async () => {
    if (!this.plan || !this.name.trim()) return;
    const titles = this.titles;
    const where = this.parts.length > 1 ? `${this.parts.length} playlists (YouTube allows ${PLAYLIST_LIMIT.toLocaleString()} songs in one): ${titles.join(', ')}` : `"${titles[0]}"`;
    if (!(await store.ask('Create the playlist?', `${this.plan.tracks.length.toLocaleString()} songs will be copied into ${where}. It is created as private, and your source playlists are not changed.`, 'Create'))) return;
    this.run = newRun(this.plan.tracks, titles);
    this.step = 'run';
    await this.go();
  };

  go = async () => {
    const run = this.run;
    if (!run || this.working) return;
    this.working = true;
    this.failure = '';
    const title = run.parts.length > 1 ? `Creating ${run.parts.length} playlists` : `Creating "${run.parts[0]?.title}"`;
    const task = tasks.start({ title, open: () => store.openCombine() });
    const { repo, yt } = await store.ctx();
    try {
      this.results = await runCombine(repo, yt, run, (done, total) => {
        this.progress = { done, total };
        tasks.patch(task, { done, total, detail: `${done.toLocaleString()} of ${total.toLocaleString()} songs copied` });
      });
      tasks.finish(task, 'done', `${run.parts.reduce((n, p) => n + p.tracks.length, 0).toLocaleString()} songs copied`);
      store.toast('Playlist created');
    } catch (e) {
      this.failure = errText(e);
      tasks.finish(task, 'failed', `Stopped: ${this.failure}`);
      store.toast(`Creating the playlist stopped: ${this.failure}`, true);
    } finally {
      this.working = false;
      await store.reload();
    }
  };

  again = () => {
    this.step = 'pick';
    this.picked = [];
    this.plan = null;
    this.run = null;
    this.results = null;
    this.failure = '';
    this.name = '';
    this.progress = { done: 0, total: 0 };
  };
}

export const flow = new CombineFlow();
