<script lang="ts">
  import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDownIcon';
  import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
  import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUpIcon';
  import ArrowsMergeIcon from 'phosphor-svelte/lib/ArrowsMergeIcon';
  import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
  import XIcon from 'phosphor-svelte/lib/XIcon';
  import { PLAYLIST_LIMIT, partTitles, type Order } from '../../core/combine';
  import { flow } from './combine.svelte';
  import Cover from '../components/Cover.svelte';
  import Dropdown from '../components/Dropdown.svelte';
  import type { DropdownOption } from '../components/dropdown';
  import { store } from '../state/store.svelte';

  const ORDERS: (DropdownOption & { value: Order })[] = [
    { value: 'playlist', label: 'One playlist after another, in each playlist\'s own order' },
    { value: 'reverse', label: 'One playlist after another, last song first' },
    { value: 'turns', label: 'Take turns: one song from each playlist in turn' },
    { value: 'title', label: 'All songs by title, A to Z' },
    { value: 'shuffle', label: 'All songs shuffled' },
  ];

  // read-only views of the flow (it lives outside this page so a run survives leaving it); writes go through `flow`
  const step = $derived(flow.step);
  const picked = $derived(flow.picked);
  const reading = $derived(flow.reading);
  const plan = $derived(flow.plan);
  const progress = $derived(flow.progress);
  const working = $derived(flow.working);
  const failure = $derived(flow.failure);
  const results = $derived(flow.results);
  const parts = $derived(flow.parts);
  const name = $derived(flow.name);
  const partNames = $derived(flow.partNames);
  const order_ = $derived(flow.chosen);
  const shown = $derived(flow.rows.filter((p) => !flow.query || p.title.toLowerCase().includes(flow.query.toLowerCase())));
  const named = $derived(flow.name.trim().length > 0);
  const pct = $derived(progress.total ? Math.round((progress.done / progress.total) * 100) : 0);
  const { toggle, move, review, start, go, again } = flow;
</script>

<div class="combine">
  <header class="combine-head">
    <span class="ico-wrap"><ArrowsMergeIcon size={26} /></span>
    <div>
      <h1>Combine playlists</h1>
      <div class="mut">Copy songs from several playlists into a new one. Unavailable songs and duplicates are left out.</div>
    </div>
  </header>

  {#if step === 'pick'}
    <section class="card pad">
      <h2>1. Choose playlists</h2>
      <div class="bar">
        <label class="search" style="width: 280px">
          <span class="ico"><MagnifyingGlassIcon size={18} /></span>
          <input type="search" placeholder="Search playlists" aria-label="Search playlists" bind:value={flow.query} />
        </label>
        <span class="grow"></span>
        <span class="mut">{picked.length} selected</span>
      </div>
      <div class="pick-list">
        {#each shown as p (p.id)}
          <label class="pick" class:on={picked.includes(p.id)}>
            <input type="checkbox" checked={picked.includes(p.id)} onchange={() => toggle(p.id)} />
            <Cover srcs={p.covers} />
            <span class="x"><span class="t1">{p.title}</span><span class="t2">{p.total} tracks{p.unavailable ? `, ${p.unavailable} unavailable` : ''}</span></span>
          </label>
        {:else}
          <div class="mut" style="padding: 12px">No playlist matches.</div>
        {/each}
      </div>
    </section>

    <section class="card pad">
      <h2>2. Playlist order</h2>
      {#if !order_.length}
        <div class="mut">Pick at least one playlist above. The first one in this list is copied first.</div>
      {:else}
        <ol class="order">
          {#each order_ as p, i (p.id)}
            <li>
              <span class="n">{i + 1}</span>
              <span class="x t1">{p.title}</span>
              <button class="btn icon sm ghost" aria-label="Move {p.title} up" disabled={i === 0} onclick={() => move(i, -1)}><ArrowUpIcon size={16} /></button>
              <button class="btn icon sm ghost" aria-label="Move {p.title} down" disabled={i === order_.length - 1} onclick={() => move(i, 1)}><ArrowDownIcon size={16} /></button>
              <button class="btn icon sm ghost" aria-label="Remove {p.title}" onclick={() => toggle(p.id)}><XIcon size={16} /></button>
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    <section class="card pad">
      <h2>3. Song order and duplicates</h2>
      <div class="stack">
        <Dropdown label="Song order" options={ORDERS} bind:value={flow.order} width="100%" />
        <label class="switch"><input type="checkbox" bind:checked={flow.likely} /> Also skip the same song uploaded twice (for example a video and its lyric video). Covers, remixes and slowed versions are always kept.</label>
        <span class="mut sm">The same video is never added twice. Greyed-out songs, and songs youtube.com lists as unavailable, are left out.</span>
      </div>
    </section>

    <div class="bar">
      <button class="btn primary" disabled={!picked.length} onclick={review}>Review</button>
    </div>
  {:else if step === 'review'}
    {#if !plan}
      <section class="card pad">
        <h2>Reading your playlists</h2>
        <div class="mut">Getting the current songs and checking their availability on YouTube Music and youtube.com ({reading.done} of {reading.total}).</div>
        <div class="meter" style:--p="{reading.total ? Math.round((reading.done / reading.total) * 100) : 0}%"><span></span></div>
      </section>
    {:else}
      <section class="card pad">
        <h2>Review</h2>
        <table class="plan">
          <thead><tr><th>Playlist</th><th>Songs</th><th>Added</th><th>Unavailable</th><th>Duplicates</th></tr></thead>
          <tbody>
            {#each plan.reports as r (r.id)}
              <tr><td>{r.title}</td><td>{r.total}</td><td>{r.added}</td><td>{r.unavailable}</td><td>{r.duplicates}</td></tr>
            {/each}
          </tbody>
          <tfoot><tr><td>Total</td><td>{plan.reports.reduce((n, r) => n + r.total, 0)}</td><td>{plan.tracks.length}</td><td>{plan.reports.reduce((n, r) => n + r.unavailable, 0)}</td><td>{plan.reports.reduce((n, r) => n + r.duplicates, 0)}</td></tr></tfoot>
        </table>
        {#if !plan.tracks.length}
          <div class="note"><WarningIcon size={18} weight="fill" /> Nothing is left to copy. Go back and choose other playlists.</div>
        {/if}
      </section>

      {#if plan.tracks.length}
        <section class="card pad">
          <h2>Name your new playlist</h2>
          <div class="stack">
            <label class="field">
              <span>Name</span>
              <input type="text" maxlength="150" placeholder="For example: Road trip, all together" bind:value={flow.name} />
            </label>
            {#if parts.length > 1}
              <div class="note"><WarningIcon size={18} weight="fill" /> That is {plan.tracks.length.toLocaleString()} songs and YouTube allows {PLAYLIST_LIMIT.toLocaleString()} in a playlist, so it continues in {parts.length - 1} more playlist{parts.length > 2 ? 's' : ''}. You can rename them:</div>
              {#each parts as part, i (i)}
                <label class="field">
                  <span>Playlist {i + 1} ({part.length.toLocaleString()} songs)</span>
                  <input type="text" maxlength="150" placeholder={partTitles(name.trim() || 'Combined', parts.length)[i]} value={i === 0 ? name : (partNames[i] ?? '')} oninput={(e) => (i === 0 ? (flow.name = e.currentTarget.value) : (flow.partNames[i] = e.currentTarget.value))} />
                </label>
              {/each}
            {/if}
          </div>
        </section>
      {/if}

      <div class="bar">
        <button class="btn" onclick={() => (flow.step = 'pick')}><ArrowLeftIcon size={16} weight="bold" /> Back</button>
        <button class="btn primary" disabled={!plan.tracks.length || !named} onclick={start}>Create playlist</button>
        {#if plan.tracks.length && !named}<span class="mut">Give the playlist a name first.</span>{/if}
      </div>
    {/if}
  {:else}
    <section class="card pad">
      <h2>{results ? 'Done' : failure ? 'Stopped' : 'Creating your playlist'}</h2>
      {#if results}
        <ul class="done">
          {#each results as r (r.id)}
            <li>
              <CheckCircleIcon size={20} weight="fill" />
              <span class="x"><b>{r.title}</b>: {r.expected.toLocaleString()} songs{r.found < r.expected ? ` (${r.found.toLocaleString()} visible so far, YouTube may need a moment)` : ''}</span>
              <button class="btn sm" onclick={() => { again(); void store.select(r.id); }}>Open</button>
            </li>
          {/each}
        </ul>
        <div class="bar"><button class="btn" onclick={again}>Combine more</button></div>
      {:else}
        <div class="mut">{progress.done.toLocaleString()} of {progress.total.toLocaleString()} songs copied. Keep the app open.</div>
        <div class="meter" style:--p="{pct}%"><span></span></div>
        {#if failure}
          <p class="err" role="alert">{failure}</p>
          <div class="mut">Nothing is lost: what was already copied stays in your playlist. Try again to carry on from there.</div>
          <div class="bar" style="margin-top: 12px"><button class="btn primary" disabled={working} onclick={go}>Try again</button></div>
        {/if}
      {/if}
    </section>
  {/if}
</div>
