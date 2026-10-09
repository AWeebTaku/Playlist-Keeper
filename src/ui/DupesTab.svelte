<script lang="ts">
  import type { DupGroup } from '../core/dupes';
  import { removeEntries, scanDuplicates } from '../services/actions';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
  import TrackRow from './TrackRow.svelte';
  import { store } from './store.svelte';

  type G = DupGroup & { checked: boolean[] };
  let groups = $state<G[]>([]);
  let scanned = $state(false);
  let busy = $state(false);
  let summary = $state('');

  const preselect = (g: DupGroup, keep: number) => g.items.map((_, i) => i !== keep && g.tier !== 'possible'); // "possible" is never pre-ticked

  $effect(() => {
    void store.selected;
    groups = [];
    scanned = false;
    summary = '';
  });

  const selected = $derived(groups.flatMap((g) => g.items.filter((_, i) => g.checked[i])));

  async function scan() {
    busy = true;
    const { yt } = await store.ctx();
    const found = await store.attempt(() => scanDuplicates(yt, store.selected!));
    if (found) {
      groups = found.map((g) => ({ ...g, checked: preselect(g, g.keep) }));
      scanned = true;
      const n = (t: string) => found.filter((g) => g.tier === t).length;
      summary = `${n('exact')} exact, ${n('likely')} likely, ${n('possible')} possible`;
    }
    busy = false;
  }

  function keep(g: G, i: number) {
    g.keep = i;
    g.checked = preselect(g, i);
  }

  async function remove() {
    const list = selected.slice(0, 15).map((i) => `${i.artist} - ${i.title}`).join('\n') + (selected.length > 15 ? `\n...and ${selected.length - 15} more` : '');
    const name = store.playlists.find((p) => p.id === store.selected)?.title;
    if (!(await store.ask(`Remove ${selected.length} ${selected.length > 1 ? 'entries' : 'entry'}?`, `From "${name}" on YouTube:\n\n${list}\n\nThis cannot be undone from here.`, 'Remove', true))) return;
    busy = true;
    const { repo, yt } = await store.ctx();
    const n = await store.attempt(() => removeEntries(repo, yt, store.selected!, selected.map((i) => i.setVideoId!).filter(Boolean)));
    busy = false;
    if (n) {
      store.toast(`Removed ${n}`);
      await store.refresh();
      await scan();
    }
  }
</script>

<p class="hint">
  <b style="color: var(--accent-text)">Exact</b> is the same video added twice. <b style="color: var(--accent-text)">Likely</b> is the same song, version, artist and length. <b style="color: var(--warn)">Possible</b> has the same title but a different artist or length and is never pre-selected. Covers, remixes, mashups and slowed
  versions are never grouped with the original. The radio button marks the copy to keep.
</p>
<div class="bar">
  <button class="btn primary" disabled={busy || !store.selected} onclick={scan}><MagnifyingGlassIcon size={16} weight="bold" />Scan this playlist</button>
  <button class="btn danger" disabled={busy || !selected.length} onclick={remove}><TrashIcon size={16} weight="bold" />{selected.length ? `Remove ${selected.length} selected` : 'Remove selected'}</button>
  <span class="mut">{summary}</span>
</div>

{#if busy && !groups.length}
  <div class="list"><div class="skel"></div><div class="skel"></div></div>
{:else if scanned && !groups.length}
  <div class="empty">No duplicates found in this playlist.</div>
{:else}
  {#each groups.slice(0, 300) as g, gi (gi)}
    <div class="card grp">
      <h4>
        <span class="chip {g.tier}">{g.tier}</span>
        <span class="t1" style="flex: 1">{g.items[0]!.title}</span>
        <span class="t2">{g.reason}</span>
      </h4>
      {#each g.items as it, ii (ii)}
        <div class="dupe">
          <input type="radio" name="keep{gi}" checked={ii === g.keep} onchange={() => keep(g, ii)} title="Keep this copy" aria-label="Keep this copy" />
          <input type="checkbox" bind:checked={g.checked[ii]} disabled={ii === g.keep} title="Remove this copy" aria-label="Remove this copy" />
          <div style="flex: 1; min-width: 0">
            <TrackRow videoId={it.videoId} title={it.title ?? ''} subtitle="{it.artist} / #{it.position} / {it.videoId}{it.available ? '' : ' / greyed out'}" duration={it.duration} />
          </div>
        </div>
      {/each}
    </div>
  {/each}
{/if}
