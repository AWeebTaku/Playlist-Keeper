<script lang="ts">
  import { addTrack, compareLists, whereElse, type Elsewhere } from '../../services/actions';
  import type { ItemRow } from '../../services/db';
  import ArrowsLeftRightIcon from 'phosphor-svelte/lib/ArrowsLeftRightIcon';
  import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
  import ColumnsIcon from 'phosphor-svelte/lib/ColumnsIcon';
  import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
  import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
  import EqualsIcon from 'phosphor-svelte/lib/EqualsIcon';
  import MinusIcon from 'phosphor-svelte/lib/MinusIcon';
  import NotEqualsIcon from 'phosphor-svelte/lib/NotEqualsIcon';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
  import QueueIcon from 'phosphor-svelte/lib/QueueIcon';
  import { onMount } from 'svelte';
  import { alignByPosition, locator, summarize } from '../../core/sideBySide';
  import Dropdown from '../components/Dropdown.svelte';
  import VirtualList from '../components/VirtualList.svelte';
  import Segmented from '../components/Segmented.svelte';
  import TrackRow from '../components/TrackRow.svelte';
  import { artistOf, titleOf } from '../state/util';
  import { store } from '../state/store.svelte';

  let mode = $state<'where' | 'ab' | 'side'>('where');
  let onlyElsewhere = $state(true);
  let includeAuto = $state(false);
  let where = $state<Map<string, Elsewhere[]> | null>(null);
  /** The saved tracks of playlist A that the "where else" check ran on. */
  let baseItems = $state<ItemRow[]>([]);
  let a = $state('');
  let b = $state('');
  let ab = $state<{ onlyA: ItemRow[]; both: ItemRow[]; onlyB: ItemRow[] } | null>(null);
  let busy = $state(false);
  /** A saved track with its place (1-based) in its own playlist, which stays the same however many rows are hidden. */
  type Numbered = ItemRow & { n: number };
  let loaded = $state<{ a: Numbered[]; b: Numbered[] } | null>(null);
  let hiddenA = $state<number[]>([]);
  let hiddenB = $state<number[]>([]);
  /** Songs taken out by "Hide matching". Kept apart from the ones hidden by hand, so each can be shown again on its own. */
  let autoA = $state<number[]>([]);
  let autoB = $state<number[]>([]);
  /** Show the list of hidden songs (to look at them or bring one back). */
  let showHidden = $state(false);
  let onlyDiff = $state(false);

  const lists = $derived(store.playlists.filter((p) => !p.hidden));
  const rows = $derived(baseItems.filter((i) => i.status !== 'removed' && (!onlyElsewhere || where?.has(i.videoId))));
  const options = $derived(lists.map((p) => ({ value: p.id, label: p.title })));

  async function runWhere() {
    if (!a) return;
    busy = true;
    const { repo } = await store.ctx();
    where = (await store.attempt(() => whereElse(repo, a, includeAuto))) ?? null;
    baseItems = where ? await repo.items(a) : [];
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

  /** Load both playlists as they are saved and lay them next to each other, position by position. */
  async function runSide() {
    if (!a || !b) return;
    if (a === b) return store.toast('Pick two different playlists.', true);
    busy = true;
    const { repo } = await store.ctx();
    const live = async (id: string) => (await repo.items(id)).filter((i) => i.status === 'ok' || i.status === 'unavailable');
    const both = await store.attempt(async () => [await live(a), await live(b)] as const);
    const num = (xs: ItemRow[]): Numbered[] => xs.map((x, i) => ({ ...x, n: i + 1 }));
    loaded = both ? { a: num(both[0]), b: num(both[1]) } : null;
    hiddenA = [];
    hiddenB = [];
    autoA = [];
    autoB = [];
    busy = false;
  }

  // hiding a song removes it from its list before the two are lined up again, so one missing song no longer shifts everything below it
  const pairs = $derived(loaded ? alignByPosition(loaded.a.filter((x) => !hiddenA.includes(x.n) && !autoA.includes(x.n)), loaded.b.filter((x) => !hiddenB.includes(x.n) && !autoB.includes(x.n))) : null);
  /** Hidden by hand (listed and checked in the panel) and hidden as matching (restored with one button). */
  const hiddenCount = $derived(hiddenA.length + hiddenB.length);
  const matchedCount = $derived(autoA.length + autoB.length);
  const hiddenRows = $derived({ a: (loaded?.a ?? []).filter((x) => hiddenA.includes(x.n)), b: (loaded?.b ?? []).filter((x) => hiddenB.includes(x.n)) });
  /** Where each hidden song sits in the other playlist (hidden or not there), so hiding never hides the answer. */
  let onlyMissing = $state(false);
  const hiddenChecked = $derived.by(() => {
    const inB = locator(loaded?.b ?? []);
    const inA = locator(loaded?.a ?? []);
    return {
      a: hiddenRows.a.map((x) => ({ x, hit: inB(x) })),
      b: hiddenRows.b.map((x) => ({ x, hit: inA(x) })),
    };
  });
  const missingCount = $derived(hiddenChecked.a.filter((r) => !r.hit).length + hiddenChecked.b.filter((r) => !r.hit).length);
  const unhide = (side: 'a' | 'b', n: number) => (side === 'a' ? (hiddenA = hiddenA.filter((x) => x !== n)) : (hiddenB = hiddenB.filter((x) => x !== n)));
  const hide = (side: 'a' | 'b', n: number) => (side === 'a' ? (hiddenA = [...hiddenA, n]) : (hiddenB = [...hiddenB, n]));
  /** Hide every song that has a match at its position; what is left is what the two lists do not share. */
  function hideMatching() {
    const same = (pairs ?? []).filter((p) => p.a && p.b && (p.verdict === 'same-video' || p.verdict === 'same-song'));
    autoA = [...autoA, ...same.map((p) => p.a!.n)];
    autoB = [...autoB, ...same.map((p) => p.b!.n)];
  }
  const sideShown = $derived((pairs ?? []).filter((p) => !onlyDiff || p.verdict !== 'same-video' && p.verdict !== 'same-song'));
  const sideSummary = $derived(pairs ? summarize(pairs) : null);
  onMount(() => {
    if (import.meta.env.DEV && location.search.includes('sbs')) {
      mode = 'side'; // screenshot harness: open the side-by-side view on the first two playlists
      a = lists[0]?.id ?? '';
      b = lists[1]?.id ?? '';
      void runSide();
    }
  });
  const nameOf = (id: string) => lists.find((p) => p.id === id)?.title ?? '';
  const VERDICT = { 'same-video': 'Same video', 'same-song': 'Same song, another upload', different: 'Different song', 'only-a': 'Only in A', 'only-b': 'Only in B' } as const;

  async function addTo(to: string, i: ItemRow) {
    const { repo, yt } = await store.ctx();
    const ok = await store.attempt(async () => (await addTrack(repo, yt, to, { videoId: i.videoId, title: i.title, artists: i.artists, duration: i.duration }), true));
    if (ok) store.toast(`Added to ${store.playlists.find((p) => p.id === to)?.title}`);
    await store.reload();
    await runAb();
  }
</script>

{#snippet hider(side: 'a' | 'b', n: number, title: string)}
  <button class="btn icon sm ghost" aria-label="Hide {title}" title="Hide this song and line the rest up again" onclick={() => hide(side, n)}><EyeSlashIcon size={16} /></button>
{/snippet}

<div class="combine wide">
<header class="combine-head">
  <span class="ico-wrap"><ArrowsLeftRightIcon size={26} /></span>
  <div>
    <h1>Compare playlists</h1>
    <div class="mut">See which songs of a playlist are also elsewhere, or how two playlists differ.</div>
  </div>
</header>

<div class="bar">
  <Segmented
    label="Compare mode"
    value={mode}
    onchange={(v) => (mode = v)}
    options={[
      { value: 'where', label: 'Where else is each track?', title: 'Where else is each track?', icon: QueueIcon },
      { value: 'ab', label: 'Playlist A vs B', title: 'Playlist A vs B', icon: ArrowsLeftRightIcon },
      { value: 'side', label: 'Side by side', title: 'Both playlists next to each other, position by position', icon: ColumnsIcon },
    ]}
  />
</div>

{#if mode === 'where'}
  <div class="bar">
    <Dropdown label="Playlist" width="260px" {options} bind:value={a} />
    <label class="switch"><input type="checkbox" bind:checked={onlyElsewhere} /> Only tracks that are also elsewhere</label>
    <label class="switch"><input type="checkbox" bind:checked={includeAuto} /> Include recaps and auto mixes</label>
    <button class="btn primary" disabled={busy || !a} onclick={runWhere}><MagnifyingGlassIcon size={16} weight="bold" />Check</button>
  </div>
  {#if busy}
    <div class="list"><div class="skel"></div><div class="skel"></div></div>
  {:else if where}
    <p class="mut">{baseItems.filter((i) => where!.has(i.videoId)).length} of {baseItems.length} tracks are also in another playlist.</p>
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
{:else if mode === 'ab'}
  <div class="bar">
    <span class="mut">A</span><Dropdown label="Playlist A" width="240px" {options} bind:value={a} />
    <span class="mut">B</span><Dropdown label="Playlist B" width="240px" {options} bind:value={b} />
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
{:else}
  <div class="bar">
    <span class="mut">A</span><Dropdown label="Playlist A" width="240px" {options} bind:value={a} />
    <span class="mut">B</span><Dropdown label="Playlist B" width="240px" {options} bind:value={b} />
    <button class="btn primary" disabled={busy || !a || !b} onclick={runSide}><ColumnsIcon size={16} weight="bold" />Load side by side</button>
  </div>
  {#if busy}
    <div class="list"><div class="skel"></div><div class="skel"></div></div>
  {:else if pairs && sideSummary}
    <div class="bar legend">
      <span class="chip link"><EqualsIcon size={12} weight="bold" />{sideSummary.same} same</span>
      <span class="chip unavailable"><NotEqualsIcon size={12} weight="bold" />{sideSummary.different} different</span>
      {#if sideSummary.onlyA}<span class="chip">{sideSummary.onlyA} only in A</span>{/if}
      {#if sideSummary.onlyB}<span class="chip">{sideSummary.onlyB} only in B</span>{/if}
      <span class="grow"></span>
      <button class="btn sm outline" disabled={!sideSummary.same} title="Hide the songs that match at their position and line the rest up again. Separate from the songs you hide yourself." onclick={hideMatching}><EyeSlashIcon size={14} /> Hide matching</button>
      {#if matchedCount}<button class="btn sm" title="Bring back the songs that Hide matching took out (songs you hid yourself stay hidden)" onclick={() => { autoA = []; autoB = []; }}><EyeIcon size={14} /> Unhide {matchedCount} matching</button>{/if}
      {#if hiddenCount}<button class="btn sm" aria-expanded={showHidden} onclick={() => (showHidden = !showHidden)}><EyeIcon size={14} /> {showHidden ? 'Close' : 'Show'} {hiddenCount} you hid</button>{/if}
      <label class="switch"><input type="checkbox" bind:checked={onlyDiff} /> Differences only</label>
    </div>
    {#if showHidden && hiddenCount}
      <div class="hidden-box">
        <div class="bar" style="margin-bottom: 8px">
          <strong>Songs you hid</strong>
          <span class="mut">Not part of the comparison. Each one is checked against the whole other playlist: {missingCount} of {hiddenCount} are not in it at all.</span>
          <span class="grow"></span>
          <label class="switch"><input type="checkbox" bind:checked={onlyMissing} /> Only songs not in the other playlist</label>
          <button class="btn sm" onclick={() => { hiddenA = []; hiddenB = []; showHidden = false; }}>Unhide all</button>
        </div>
        <div class="cols two">
          {#each [{ side: 'a' as const, title: `A: ${nameOf(a)}`, other: 'B', rows: hiddenChecked.a.filter((r) => !onlyMissing || !r.hit) }, { side: 'b' as const, title: `B: ${nameOf(b)}`, other: 'A', rows: hiddenChecked.b.filter((r) => !onlyMissing || !r.hit) }] as col (col.side)}
            <div>
              <h3 style="margin: 0 0 8px; font-size: 14px">{col.title} <span class="chip">{col.rows.length}</span></h3>
              <div class="list">
                {#each col.rows as { x, hit } (x.n)}
                  <div class="item">
                    <TrackRow index={x.n} videoId={x.videoId} title={titleOf(x)} subtitle={artistOf(x)} duration={x.duration}>
                      {#if x.status === 'unavailable'}<span class="chip unavailable"><WarningIcon size={12} weight="fill" />Greyed out</span>{/if}
                      {#if hit}<span class="chip link" title={hit.kind === 'same-video' ? 'The same video' : 'The same song, another upload'}>In {col.other} at #{hit.found.n}{hit.kind === 'same-song' ? ' (same song)' : ''}</span>{:else}<span class="chip removed">Not in {col.other}</span>{/if}
                      <button class="btn sm outline" onclick={() => unhide(col.side, x.n)}><EyeIcon size={14} /> Unhide</button>
                    </TrackRow>
                  </div>
                {:else}
                  <div class="mut" style="padding: 8px 0">None hidden here.</div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    {#if sideShown.length}
      <div class="sbs">
        <div class="sbs-head"><span>A: {nameOf(a)}</span><span aria-hidden="true">#</span><span>B: {nameOf(b)}</span></div>
        <VirtualList items={sideShown} key={(p) => String(p.index)} estimate={60} gap={4}>
          {#snippet row(p)}
          <div class="sbs-row {p.verdict}" title={VERDICT[p.verdict]}>
            {#if p.a}<div class="sbs-cell"><TrackRow index={p.a.n} videoId={p.a.videoId} title={titleOf(p.a)} subtitle={artistOf(p.a)} duration={p.a.duration}>{@render hider('a', p.a.n, titleOf(p.a))}</TrackRow></div>{:else}<div class="sbs-cell none">Nothing at {p.index}</div>{/if}
            <div class="sbs-mid" aria-label={VERDICT[p.verdict]}>
              {#if p.verdict === 'same-video' || p.verdict === 'same-song'}<EqualsIcon size={20} weight="bold" />{:else if p.verdict === 'different'}<NotEqualsIcon size={20} weight="bold" />{:else}<MinusIcon size={20} weight="bold" />{/if}
            </div>
            {#if p.b}<div class="sbs-cell"><TrackRow index={p.b.n} videoId={p.b.videoId} title={titleOf(p.b)} subtitle={artistOf(p.b)} duration={p.b.duration}>{@render hider('b', p.b.n, titleOf(p.b))}</TrackRow></div>{:else}<div class="sbs-cell none">Nothing at {p.index}</div>{/if}
          </div>
          {/snippet}
        </VirtualList>
      </div>
    {:else}
      <div class="empty">{onlyDiff ? 'No differences: both playlists match at every position.' : hiddenCount || matchedCount ? 'Every song is hidden.' : 'Both playlists are empty.'}</div>
    {/if}
  {/if}
{/if}
</div>
