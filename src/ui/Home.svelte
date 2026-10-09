<script lang="ts">
  import ArrowsClockwiseIcon from 'phosphor-svelte/lib/ArrowsClockwiseIcon';
  import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
  import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
  import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
  import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
  import MusicNotesIcon from 'phosphor-svelte/lib/MusicNotesIcon';
  import QueueIcon from 'phosphor-svelte/lib/QueueIcon';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
  import Avatar from './Avatar.svelte';
  import Cover from './Cover.svelte';
  import { store } from './store.svelte';
  import { ago, coverUrls } from './util';

  const DAY = 86400;
  const visible = $derived(store.playlists.filter((p) => !p.hidden));
  const tracks = $derived(visible.reduce((n, p) => n + p.total, 0));
  const lost = $derived(visible.reduce((n, p) => n + p.missing, 0));
  const lastSync = $derived(Math.max(0, ...visible.map((p) => p.lastSync ?? 0)));
  const attention = $derived([...visible].filter((p) => p.missing > 0).sort((a, b) => b.missing - a.missing).slice(0, 5));
  const stale = $derived(!lastSync || Date.now() / 1000 - lastSync > DAY);
  const first = $derived((store.profile?.name ?? '').trim().split(/\s+/u)[0] ?? '');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
</script>

<div class="home">
  <section class="home-hero">
    <Avatar profile={store.profile} />
    <div style="min-width: 0">
      <h1>{greeting}{first ? `, ${first}` : ''}</h1>
      <p>
        {#if !visible.length}
          Press <strong>Sync all</strong> to save your first copy of your playlists. After that, anything YouTube removes or greys out is remembered here.
        {:else if lost}
          {lost} track{lost > 1 ? 's' : ''} in your playlists {lost > 1 ? 'are' : 'is'} greyed out or removed. Open a playlist to find replacements.
        {:else}
          Everything in your saved playlists is still playable.
        {/if}
      </p>
    </div>
    <button class="btn cta" class:primary={stale} class:outline={!stale} disabled={store.sync.running} onclick={() => store.runSync()}>
      {#if store.sync.running}<span class="spin ico"><CircleNotchIcon size={18} weight="bold" /></span> Syncing {store.sync.done} of {store.sync.total}{:else}<ArrowsClockwiseIcon size={18} weight="bold" /> Sync all{/if}
    </button>
  </section>

  {#if !visible.length}
    <section class="steps" aria-label="How it works">
      <div class="step"><span class="ico-wrap"><ArrowsClockwiseIcon size={20} weight="bold" /></span><strong>1. Sync</strong><span class="mut">Save a copy of every playlist on this computer. Run it whenever you like.</span></div>
      <div class="step"><span class="ico-wrap"><WarningIcon size={20} weight="fill" /></span><strong>2. Spot lost tracks</strong><span class="mut">Anything YouTube greys out or removes is flagged, and you still see what it was.</span></div>
      <div class="step"><span class="ico-wrap"><MagnifyingGlassIcon size={20} weight="bold" /></span><strong>3. Fix them</strong><span class="mut">Find re-uploads, full-length versions and duplicates, then add them with one click.</span></div>
    </section>
  {:else}
    <section class="stats" aria-label="Summary">
      <div class="stat"><span class="ico-wrap"><QueueIcon size={20} /></span><span class="v">{visible.length}</span><span class="l">Playlists</span></div>
      <div class="stat"><span class="ico-wrap"><MusicNotesIcon size={20} /></span><span class="v">{tracks.toLocaleString()}</span><span class="l">Tracks saved</span></div>
      <div class="stat" class:warn={lost > 0}><span class="ico-wrap"><WarningIcon size={20} weight="fill" /></span><span class="v">{lost.toLocaleString()}</span><span class="l">Greyed out or removed</span></div>
      <div class="stat"><span class="ico-wrap"><ClockIcon size={20} /></span><span class="v" style="font-size: 22px; padding: 4px 0">{lastSync ? ago(lastSync) : 'Never'}</span><span class="l">Last synced</span></div>
    </section>

    <section>
      <h2>Needs attention</h2>
      {#if attention.length}
        <div class="attn">
          {#each attention as p (p.id)}
            <button onclick={() => store.select(p.id)}>
              <Cover srcs={coverUrls(p)} iconSize={22} />
              <span class="x">
                <div class="t1">{p.title}</div>
                <div class="t2">{p.total.toLocaleString()} tracks</div>
              </span>
              <span class="chip unavailable"><WarningIcon size={12} weight="fill" />{p.missing} greyed out or removed</span>
              <CaretRightIcon size={16} />
            </button>
          {/each}
        </div>
      {:else}
        <div class="empty"><CheckCircleIcon size={32} weight="fill" />Nothing needs attention right now.</div>
      {/if}
    </section>
  {/if}
</div>
