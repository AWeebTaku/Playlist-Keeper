<script lang="ts">
  import { addTrack, compareLists, whereElse, type Elsewhere } from '../services/actions';
  import type { ItemRow } from '../services/db';
  import ArrowsLeftRightIcon from 'phosphor-svelte/lib/ArrowsLeftRightIcon';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
  import QueueIcon from 'phosphor-svelte/lib/QueueIcon';
  import Segmented from './Segmented.svelte';
  import TrackRow from './TrackRow.svelte';
  import { artistOf, titleOf } from './util';
  import { store } from './store.svelte';

  let mode = $state<'where' | 'ab'>('where');
  let onlyElsewhere = $state(true);
  let includeAuto = $state(false);
  let where = $state<Map<string, Elsewhere[]> | null>(null);
  let a = $state('');
  let b = $state('');
  let ab = $state<{ onlyA: ItemRow[]; both: ItemRow[]; onlyB: ItemRow[] } | null>(null);
  let busy = $state(false);

  const lists = $derived(store.playlists.filter((p) => !p.hidden));
  const rows = $derived(store.items.filter((i) => i.status !== 'removed' && (!onlyElsewhere || where?.has(i.videoId))));

  $effect(() => {
    a = store.selected ?? '';
    where = null;
    ab = null;
  });

  async function runWhere() {
    busy = true;
    const { repo } = await store.ctx();
    where = (await store.attempt(() => whereElse(repo, store.selected!, includeAuto))) ?? null;
    busy = false;
  }

  async function runAb() {
    if (!a || !b) return;
    if (a === b) return store.toast('Pick two different playlists.', true);
    busy = true;
    const { repo } = await store.ctx();
    ab = (await store.attempt(() => compareLists(repo, a, b))) ?? null;
    busy = false;
  }

  async function addTo(to: string, i: ItemRow) {
    const { repo, yt } = await store.ctx();
    const ok = await store.attempt(async () => (await addTrack(repo, yt, to, { videoId: i.videoId, title: i.title, artists: i.artists, duration: i.duration }), true));
    if (ok) store.toast(`Added to ${store.playlists.find((p) => p.id === to)?.title}`);
    await store.reload();
    await runAb();
  }
</script>

<div class="bar">
  <Segmented
    label="Compare mode"
    value={mode}
    onchange={(v) => (mode = v)}
    options={[
      { value: 'where', label: 'Where else is each track?', title: 'Where else is each track?', icon: QueueIcon },
      { value: 'ab', label: 'Playlist A vs B', title: 'Playlist A vs B', icon: ArrowsLeftRightIcon },
    ]}
  />
</div>

{#if mode === 'where'}
  <div class="bar">
    <label class="switch"><input type="checkbox" bind:checked={onlyElsewhere} /> Only tracks that are also elsewhere</label>
    <label class="switch"><input type="checkbox" bind:checked={includeAuto} /> Include recaps and auto mixes</label>
    <button class="btn primary" disabled={busy} onclick={runWhere}><MagnifyingGlassIcon size={16} weight="bold" />Check</button>
  </div>
  {#if busy}
    <div class="list"><div class="skel"></div><div class="skel"></div></div>
  {:else if where}
    <p class="mut">{store.items.filter((i) => where!.has(i.videoId)).length} of {store.items.length} tracks are also in another playlist.</p>
    {#if rows.length}
      <div class="list">
        {#each rows.slice(0, 300) as i (i.videoId)}
          <div class="item">
            <TrackRow videoId={i.videoId} title={titleOf(i)} subtitle={artistOf(i)} duration={i.duration}>
              {#each (where.get(i.videoId) ?? []).slice(0, 4) as w (w.playlistId)}<span class="chip {w.how === 'same video' ? 'link' : ''}" title={w.how}>{w.title}</span>{/each}
            </TrackRow>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty">No tracks to show.</div>
    {/if}
  {/if}
{:else}
  <div class="bar">
    <label>A <select bind:value={a}>{#each lists as p (p.id)}<option value={p.id}>{p.title}</option>{/each}</select></label>
    <label>B <select bind:value={b}>{#each lists as p (p.id)}<option value={p.id}>{p.title}</option>{/each}</select></label>
    <button class="btn primary" disabled={busy || !b} onclick={runAb}><ArrowsLeftRightIcon size={16} weight="bold" />Compare</button>
  </div>
  {#if busy}
    <div class="list"><div class="skel"></div><div class="skel"></div></div>
  {:else if ab}
    <div class="cols">
      {#each [{ t: 'Only in A', l: ab.onlyA, to: b, tag: 'B' }, { t: 'In both', l: ab.both, to: '', tag: '' }, { t: 'Only in B', l: ab.onlyB, to: a, tag: 'A' }] as col (col.t)}
        <div>
          <h3 style="margin: 0 0 8px; font-size: 15px">{col.t} <span class="chip">{col.l.length}</span></h3>
          <div class="list">
            {#each col.l.slice(0, 100) as i (i.videoId)}
              <div class="item">
                <TrackRow videoId={i.videoId} title={titleOf(i)} subtitle={artistOf(i)} duration={i.duration}>
                  {#if col.to}<button class="btn sm outline" onclick={() => addTo(col.to, i)}><PlusIcon size={14} weight="bold" />Add to {col.tag}</button>{/if}
                </TrackRow>
              </div>
            {:else}
              <div class="empty">None</div>
            {/each}
          </div>
          {#if col.l.length > 100}<p class="mut">Showing 100 of {col.l.length}.</p>{/if}
        </div>
      {/each}
    </div>
  {/if}
{/if}
