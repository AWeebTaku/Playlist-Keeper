<script lang="ts">
  import { activeCount, applyFilter, badLength, EMPTY, parseLength, type Criteria, type Sort, type StatusFilter } from '../../core/filter';
  import { addTrack, findReplacements, fullVersions, replaceTrack, type FullVersion, type Replacement } from '../../services/actions';
  import type { ItemRow } from '../../services/db';
  import ArrowsCounterClockwiseIcon from 'phosphor-svelte/lib/ArrowsCounterClockwiseIcon';
  import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
  import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
  import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
  import ProhibitIcon from 'phosphor-svelte/lib/ProhibitIcon';
  import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
  import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
  import logo from '../../assets/logo.png';
  import Dropdown from '../components/Dropdown.svelte';
  import type { DropdownOption } from '../components/dropdown';
  import Segmented from '../components/Segmented.svelte';
  import TrackRow from '../components/TrackRow.svelte';
  import VirtualList from '../components/VirtualList.svelte';
  import { artistOf, hideBroken, mmss, statusLabel, thumb, titleOf, webNote } from '../state/util';
  import { store } from '../state/store.svelte';

  const CARD = 220; // minimum card width, as in the stylesheet
  const GAP = 16;
  const HINT = 'Every word must match. "quoted phrase" matches as written, -word leaves a word out.';
  const STATUSES: (DropdownOption & { value: StatusFilter })[] = [
    { value: 'all', label: 'Any status' },
    { value: 'ok', label: 'Playable' },
    { value: 'problem', label: 'Greyed out, removed or unavailable' },
    { value: 'unavailable', label: 'Greyed out on YouTube Music' },
    { value: 'removed', label: 'Removed from the playlist' },
    { value: 'web-unavailable', label: 'Unavailable on youtube.com' },
    { value: 'web-plays', label: 'Greyed out here, plays on youtube.com' },
  ];
  const SORTS: (DropdownOption & { value: Sort })[] = [
    { value: 'playlist', label: 'Playlist order' },
    { value: 'title', label: 'Title A to Z' },
    { value: 'artist', label: 'Artist A to Z' },
    { value: 'short', label: 'Shortest first' },
    { value: 'long', label: 'Longest first' },
    { value: 'recent', label: 'Recently added first' },
  ];

  /** Width of the card area, to know how many cards fit in a row (the grid is windowed row by row). */
  let gridW = $state(0);
  let c = $state<Criteria>({ ...EMPTY });
  let panel = $state(import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('filters'));
  let found = $state<Record<string, Replacement[] | 'loading'>>({});
  let fulls = $state<Record<string, { candidates: FullVersion[]; queries: string[] } | 'loading'>>({});

  const shown = $derived(applyFilter(store.items, c));
  const active = $derived(activeCount(c));
  const maxSec = $derived(parseLength(c.max));
  const cols = $derived(Math.max(1, Math.floor((gridW + GAP) / (CARD + GAP))));
  const gridRows = $derived(Array.from({ length: Math.ceil(shown.length / cols) }, (_, r) => shown.slice(r * cols, r * cols + cols)));

  /** Place in the playlist (1-based), counting only songs still in it; kept when the list is filtered or sorted. */
  const numbers = $derived.by(() => {
    const m: Record<string, number> = {};
    let n = 0;
    for (const i of store.items) if (i.status !== 'removed') m[i.videoId] = ++n;
    return m;
  });
  const numberOf = (i: ItemRow) => numbers[i.videoId] ?? '-';
  /**
   * "Find full version" is offered only where the user is looking for short tracks: inside a length filter, or when the
   * openings/endings filter is on. A short song is not necessarily a clip, so nothing is flagged on its length alone.
   */
  const canFull = (i: ItemRow) => i.status !== 'removed' && i.duration !== null && (maxSec !== null ? i.duration <= maxSec : c.themed);

  $effect(() => {
    void store.selected;
    found = {};
    fulls = {};
    c = { ...EMPTY };
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

  async function findFull(i: ItemRow) {
    fulls[i.videoId] = 'loading';
    const { repo, yt } = await store.ctx();
    const r = await store.attempt(() => fullVersions(repo, yt, store.selected!, i));
    if (r) fulls[i.videoId] = r;
    else delete fulls[i.videoId];
  }

  async function addFull(cand: FullVersion) {
    const { repo, yt } = await store.ctx();
    const ok = await store.attempt(async () => (await addTrack(repo, yt, store.selected!, { videoId: cand.videoId, title: cand.title, artists: cand.artists, duration: cand.duration }), true));
    if (ok) store.toast('Added to this playlist');
    await store.refresh();
  }

  async function replaceFull(i: ItemRow, cand: FullVersion) {
    if (!(await store.ask('Replace the short clip?', 'The full version is added and the short clip is removed from this playlist.', 'Replace'))) return;
    const { repo, yt } = await store.ctx();
    const ok = await store.attempt(async () => (await replaceTrack(repo, yt, store.selected!, i.videoId, { videoId: cand.videoId, title: cand.title, artists: cand.artists, duration: cand.duration }, true), true));
    if (ok) store.toast('Replaced');
    await store.refresh();
  }
</script>

<div class="bar">
  <label class="search" style="width: 320px">
    <span class="ico"><MagnifyingGlassIcon size={18} /></span>
    <input type="search" placeholder="Search title, artist or album" aria-label="Search this playlist" title={HINT} bind:value={c.text} />
  </label>
  <button class="btn outline" aria-expanded={panel} aria-controls="filters" onclick={() => (panel = !panel)}><FunnelIcon size={16} weight={active ? 'fill' : 'regular'} /> Filters{#if active}<span class="badge">{active}</span>{/if}</button>
  <Dropdown label="Sort" width="200px" options={SORTS} bind:value={c.sort} />
  {#if active || c.sort !== 'playlist'}<button class="btn sm ghost" onclick={() => (c = { ...EMPTY })}>Clear</button>{/if}
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

{#if panel}
  <div class="filters" id="filters">
    <label class="field"><span>Title contains</span><input type="text" bind:value={c.title} /></label>
    <label class="field"><span>Artist contains</span><input type="text" bind:value={c.artist} /></label>
    <label class="field"><span>Album contains</span><input type="text" bind:value={c.album} /></label>
    <label class="field"><span>Length from</span><input type="text" inputmode="numeric" placeholder="0:00" aria-invalid={badLength(c.min)} bind:value={c.min} /></label>
    <label class="field"><span>Length up to</span><input type="text" inputmode="numeric" placeholder="3:30 or 210" aria-invalid={badLength(c.max)} bind:value={c.max} /></label>
    <div class="field"><span>Status</span><Dropdown label="Status" width="100%" options={STATUSES} bind:value={c.status} /></div>
    <label class="switch wide"><input type="checkbox" bind:checked={c.themed} /> Only openings, endings, intros, outros and themes</label>
    {#if badLength(c.min) || badLength(c.max)}<span class="err sm wide">Type a length like 2:30 or 150 (seconds).</span>{/if}
  </div>
{/if}

<div class="mut count" aria-live="polite">{shown.length === store.items.length ? `${store.items.length.toLocaleString()} tracks` : `${shown.length.toLocaleString()} of ${store.items.length.toLocaleString()} tracks`}</div>

{#if store.loadingItems}
  <div class="list"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
{:else if !shown.length}
  <div class="empty"><img src={logo} alt="" />{store.items.length ? 'Nothing matches these filters.' : 'This playlist has no saved tracks yet. Press Sync all.'}</div>
{:else if store.view === 'grid'}
  <div bind:clientWidth={gridW}>
    <VirtualList items={gridRows} key={(r) => r[0]!.videoId} estimate={250} gap={GAP}>
      {#snippet row(cards)}
        <div class="grid" style:grid-template-columns="repeat({cols}, minmax(0, 1fr))">
          {#each cards as i (i.videoId)}
      <div class="gcard">
        <span class="idx-badge">{numberOf(i)}</span>
        <img class="th lg" loading="lazy" src={thumb(i.videoId)} alt="" onerror={hideBroken} />
        <div class="b">
          <div class="t1">{titleOf(i)}</div>
          <div class="t2">{artistOf(i)} / {mmss(i.duration)}</div>
          {#if i.status !== 'ok' || webNote(i)}
            <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px">
              {#if i.status !== 'ok'}<span class="chip {i.status}"><WarningIcon size={12} weight="fill" />{statusLabel(i.status)}</span>{/if}
              {#if webNote(i)}<span class="chip {webNote(i)?.kind}">{webNote(i)?.text}</span>{/if}
            </div>
          {/if}
        </div>
      </div>
          {/each}
        </div>
      {/snippet}
    </VirtualList>
  </div>
{:else}
  <VirtualList items={shown} key={(i) => i.videoId} gap={6}>
    {#snippet row(i)}
      {@const f = found[i.videoId]}
      <div class="item">
        <TrackRow index={numberOf(i)} videoId={i.videoId} title={titleOf(i)} subtitle={artistOf(i) + (i.cleanTitle && i.title && i.cleanTitle !== i.title ? ` / original: ${i.title}` : '')} duration={i.duration}>
          {#if i.status !== 'ok'}
            <span class="chip {i.status}">{#if i.status === 'removed'}<ProhibitIcon size={12} weight="bold" />{:else}<WarningIcon size={12} weight="fill" />{/if}{statusLabel(i.status)}</span>
            {#if webNote(i)}<span class="chip {webNote(i)?.kind}">{webNote(i)?.text}</span>{/if}
            <button class="btn sm outline" disabled={f === 'loading'} onclick={() => find(i)}><MagnifyingGlassIcon size={14} />{f === 'loading' ? 'Searching...' : 'Find replacement'}</button>
          {:else if webNote(i)}
            <span class="chip {webNote(i)?.kind}">{webNote(i)?.text}</span>
          {/if}
          {#if canFull(i)}
            <button class="btn sm outline" disabled={fulls[i.videoId] === 'loading'} title="Search for the full-length song" onclick={() => findFull(i)}><MagnifyingGlassIcon size={14} />{fulls[i.videoId] === 'loading' ? 'Searching...' : 'Find full version'}</button>
          {/if}
        </TrackRow>
        {#if fulls[i.videoId]}
          {@const r = fulls[i.videoId]}
          <div class="sub">
            {#if r === 'loading'}
              <div class="skel" style="height: 40px"></div>
            {:else if r}
              {#each r.candidates as cand (cand.videoId)}
                <TrackRow videoId={cand.videoId} title={cand.title ?? ''} subtitle="{cand.artists} / full {mmss(cand.duration)} vs clip {mmss(i.duration)} / match {Math.round(cand.score * 100)}%" duration={cand.duration}>
                  {#if cand.inPlaylist}<span class="chip">Already in this playlist</span>{:else if cand.elsewhere.length}<span class="chip link">Also in {cand.elsewhere.join(', ')}</span>{/if}
                  <button class="btn sm primary" onclick={() => addFull(cand)}><PlusIcon size={14} weight="bold" />Add</button>
                  <button class="btn sm outline" onclick={() => replaceFull(i, cand)}><ArrowsCounterClockwiseIcon size={14} />Replace</button>
                </TrackRow>
              {:else}
                <div class="mut" style="padding: 8px 0">No full version found for: {r.queries.join(' | ') || '(no usable title)'}.</div>
              {/each}
            {/if}
          </div>
        {/if}
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
    {/snippet}
  </VirtualList>
{/if}
