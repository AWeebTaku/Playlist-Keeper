<script lang="ts">
  import { addTrack, fullVersions, replaceTrack, type FullVersion } from '../services/actions';
  import type { ItemRow } from '../services/db';
  import TrackRow from './TrackRow.svelte';
  import { artistOf, mmss, titleOf } from './util';
  import { store } from './store.svelte';

  const THEMED = /opening|ending|\bop\s*\d*\b|\bed\s*\d*\b|intro|outro|theme|tv size|オープニング|エンディング|主題歌/iu;
  let max = $state(150);
  let themedOnly = $state(true);
  let target = $state('');
  let results = $state<Record<string, { candidates: FullVersion[]; queries: string[] } | 'loading'>>({});

  const targets = $derived(store.playlists.filter((p) => !p.hidden));
  const clips = $derived(
    store.items
      .filter((i) => i.status !== 'removed' && i.duration && i.duration < max && (!themedOnly || THEMED.test(`${i.title ?? ''} ${i.cleanTitle ?? ''}`)))
      .sort((a, b) => a.duration! - b.duration!),
  );

  $effect(() => {
    target = store.selected ?? '';
    results = {};
  });

  async function find(i: ItemRow) {
    results[i.videoId] = 'loading';
    const { repo, yt } = await store.ctx();
    const r = await store.attempt(() => fullVersions(repo, yt, store.selected!, i));
    if (r) results[i.videoId] = r;
    else delete results[i.videoId];
  }

  async function add(c: FullVersion) {
    const { repo, yt } = await store.ctx();
    const ok = await store.attempt(async () => (await addTrack(repo, yt, target, { videoId: c.videoId, title: c.title, artists: c.artists, duration: c.duration }), true));
    if (ok) store.toast(`Added to ${store.playlists.find((p) => p.id === target)?.title}`);
    await store.refresh();
  }

  async function replace(i: ItemRow, c: FullVersion) {
    if (!(await store.ask('Replace the short clip?', 'The full version is added and the short clip is removed from this playlist.', 'Replace'))) return;
    const { repo, yt } = await store.ctx();
    const ok = await store.attempt(async () => (await replaceTrack(repo, yt, store.selected!, i.videoId, { videoId: c.videoId, title: c.title, artists: c.artists, duration: c.duration }, true), true));
    if (ok) store.toast('Replaced');
    await store.refresh();
  }
</script>

<p class="hint">Clips like anime openings, endings, intros and outros are often a cut of a longer song. Find the full version and add it. Adding keeps the short clip; Replace removes it.</p>
<div class="bar">
  <label>Shorter than <input type="range" min="30" max="300" step="10" bind:value={max} /> <b class="dur" style="display: inline-block; text-align: left">{mmss(max)}</b></label>
  <label><input type="checkbox" bind:checked={themedOnly} /> Only titles with opening, ending, intro, outro or theme</label>
  <span class="grow"></span>
  <label>Add to <select bind:value={target} aria-label="Target playlist">{#each targets as p (p.id)}<option value={p.id}>{p.title}</option>{/each}</select></label>
</div>

{#if clips.length}
  <div class="mut" style="margin-bottom: 8px">{clips.length} short track{clips.length > 1 ? 's' : ''}</div>
  <div class="list">
    {#each clips.slice(0, 200) as i (i.videoId)}
      {@const r = results[i.videoId]}
      <div class="item">
        <TrackRow videoId={i.videoId} title={titleOf(i)} subtitle={artistOf(i)} duration={i.duration}>
          <button class="btn sm" disabled={r === 'loading'} onclick={() => find(i)}>{r === 'loading' ? 'Searching...' : 'Find full version'}</button>
        </TrackRow>
        {#if r === 'loading'}
          <div class="sub"><div class="skel" style="height: 40px"></div></div>
        {:else if r}
          <div class="sub">
            {#each r.candidates as c (c.videoId)}
              <TrackRow videoId={c.videoId} title={c.title ?? ''} subtitle="{c.artists} / full {mmss(c.duration)} vs clip {mmss(i.duration)} / match {Math.round(c.score * 100)}%" duration={c.duration}>
                {#if c.inPlaylist}<span class="chip">Already in this playlist</span>{:else if c.elsewhere.length}<span class="chip link">Also in {c.elsewhere.join(', ')}</span>{/if}
                <button class="btn sm primary" onclick={() => add(c)}>Add</button>
                <button class="btn sm" disabled={target !== store.selected} title={target !== store.selected ? 'Replace only works when "Add to" is this playlist' : ''} onclick={() => replace(i, c)}>Replace</button>
              </TrackRow>
            {:else}
              <div class="mut" style="padding: 8px 0">No full version found for: {r.queries.join(' | ') || '(no usable title)'}.</div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  {#if clips.length > 200}<p class="mut">Showing the 200 shortest. Lower the length to narrow it down.</p>{/if}
{:else}
  <div class="empty">No tracks this short in this playlist.</div>
{/if}
