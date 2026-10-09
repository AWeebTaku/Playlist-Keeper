<script lang="ts">
  import { findReplacements, replaceTrack, type Replacement } from '../services/actions';
  import type { ItemRow } from '../services/db';
  import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
  import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import ProhibitIcon from 'phosphor-svelte/lib/ProhibitIcon';
  import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
  import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
  import logo from '../assets/logo.png';
  import Segmented from './Segmented.svelte';
  import TrackRow from './TrackRow.svelte';
  import { artistOf, hideBroken, mmss, statusLabel, thumb, titleOf } from './util';
  import { store } from './store.svelte';

  const STEP = 150;
  let limit = $state(STEP);
  let filter = $state('');
  let onlyMissing = $state(false);
  let found = $state<Record<string, Replacement[] | 'loading'>>({});

  const shown = $derived(
    store.items.filter((i) => (!onlyMissing || i.status !== 'ok') && (!filter || `${i.cleanTitle ?? ''} ${i.title ?? ''} ${i.cleanArtist ?? ''} ${i.artists}`.toLowerCase().includes(filter.toLowerCase()))),
  );

  $effect(() => {
    void store.selected;
    limit = STEP;
    found = {};
  });

  async function find(i: ItemRow) {
    found[i.videoId] = 'loading';
    const { yt } = await store.ctx();
    const r = await store.attempt(() => findReplacements(yt, i));
    if (r) found[i.videoId] = r;
    else delete found[i.videoId];
  }

  async function accept(i: ItemRow, r: Replacement) {
    if (!(await store.ask('Replace the greyed-out track?', `"${r.title}" by ${r.artists} is added to this playlist and the greyed-out original is removed.`, 'Replace'))) return;
    const { repo, yt } = await store.ctx();
    const done = await store.attempt(async () => (await replaceTrack(repo, yt, store.selected!, i.videoId, r), true));
    if (done) store.toast('Replaced');
    await store.refresh();
  }
</script>

<div class="bar">
  <label class="search" style="width: 280px">
    <span class="ico"><MagnifyingGlassIcon size={18} /></span>
    <input type="search" placeholder="Filter this playlist" aria-label="Filter" bind:value={filter} />
  </label>
  <label class="switch"><input type="checkbox" bind:checked={onlyMissing} /> Greyed out or removed only</label>
  <span class="grow"></span>
  <Segmented
    label="Track layout"
    value={store.view}
    onchange={(v) => store.setView(v)}
    options={[
      { value: 'list', title: 'List', icon: ListBulletsIcon },
      { value: 'grid', title: 'Grid', icon: SquaresFourIcon },
    ]}
  />
</div>

{#if store.loadingItems}
  <div class="list"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
{:else if !shown.length}
  <div class="empty"><img src={logo} alt="" />{store.items.length ? 'Nothing matches this filter.' : 'This playlist has no saved tracks yet. Press Sync all.'}</div>
{:else if store.view === 'grid'}
  <div class="grid">
    {#each shown.slice(0, limit) as i (i.videoId)}
      <div class="gcard">
        <img class="th lg" loading="lazy" src={thumb(i.videoId)} alt="" onerror={hideBroken} />
        <div class="b">
          <div class="t1">{titleOf(i)}</div>
          <div class="t2">{artistOf(i)} / {mmss(i.duration)}</div>
          {#if i.status !== 'ok'}<div style="margin-top: 8px"><span class="chip {i.status}"><WarningIcon size={12} weight="fill" />{statusLabel(i.status)}</span></div>{/if}
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="list">
    {#each shown.slice(0, limit) as i (i.videoId)}
      {@const f = found[i.videoId]}
      <div class="item">
        <TrackRow videoId={i.videoId} title={titleOf(i)} subtitle={artistOf(i) + (i.cleanTitle && i.title && i.cleanTitle !== i.title ? ` / original: ${i.title}` : '')} duration={i.duration}>
          {#if i.status !== 'ok'}
            <span class="chip {i.status}">{#if i.status === 'removed'}<ProhibitIcon size={12} weight="bold" />{:else}<WarningIcon size={12} weight="fill" />{/if}{statusLabel(i.status)}</span>
            <button class="btn sm outline" disabled={f === 'loading'} onclick={() => find(i)}><MagnifyingGlassIcon size={14} />{f === 'loading' ? 'Searching...' : 'Find replacement'}</button>
          {/if}
        </TrackRow>
        {#if f === 'loading'}
          <div class="sub"><div class="skel" style="height: 40px"></div></div>
        {:else if f}
          <div class="sub">
            {#each f as r (r.videoId)}
              <TrackRow videoId={r.videoId} title={r.title ?? ''} subtitle="{r.artists} / {r.type} / match {Math.round(r.score * 100)}%" duration={r.duration}>
                <button class="btn sm primary" onclick={() => accept(i, r)}><CheckIcon size={14} weight="bold" />Accept</button>
              </TrackRow>
            {:else}
              <div class="mut" style="padding: 8px 0">No candidates found.</div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

{#if shown.length > limit}
  <div class="bar" style="margin-top: 12px">
    <button class="btn" onclick={() => (limit += 300)}>Show {Math.min(300, shown.length - limit)} more</button>
    <span class="mut">{limit} of {shown.length}</span>
  </div>
{/if}
