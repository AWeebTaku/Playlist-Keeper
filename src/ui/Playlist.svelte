<script lang="ts">
  import ArrowsLeftRightIcon from 'phosphor-svelte/lib/ArrowsLeftRightIcon';
  import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
  import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
  import MusicNotesIcon from 'phosphor-svelte/lib/MusicNotesIcon';
  import SparkleIcon from 'phosphor-svelte/lib/SparkleIcon';
  import TimerIcon from 'phosphor-svelte/lib/TimerIcon';
  import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
  import CleanTab from './CleanTab.svelte';
  import CompareTab from './CompareTab.svelte';
  import Cover from './Cover.svelte';
  import DupesTab from './DupesTab.svelte';
  import Home from './Home.svelte';
  import ItemsTab from './ItemsTab.svelte';
  import ProfileMenu from './ProfileMenu.svelte';
  import ShortTab from './ShortTab.svelte';
  import { store } from './store.svelte';
  import { ago, coverUrls } from './util';

  const TABS = [
    ['items', 'Items', MusicNotesIcon],
    ['short', 'Short tracks', TimerIcon],
    ['compare', 'Compare', ArrowsLeftRightIcon],
    ['clean', 'Cleanup', SparkleIcon],
    ['dupes', 'Duplicates', CopyIcon],
  ] as const;
  const playlist = $derived(store.playlists.find((p) => p.id === store.selected));
  const covers = $derived(playlist ? coverUrls(playlist) : []);
</script>

<div class="topbar glass">
  <span class="where">{playlist ? 'Playlist' : 'Home'}</span>
  <ProfileMenu />
</div>

{#if playlist}
  <header class="banner">
    <div class="banner-bg" style:background-image={covers[0] ? `url("${covers[0]}")` : 'none'}></div>
    <div class="banner-row">
      <Cover srcs={covers} iconSize={56} />
      <div style="min-width: 0">
        <h1>{playlist.title}</h1>
        <div class="chips">
          <span class="chip"><MusicNotesIcon size={13} /> {playlist.total} tracks</span>
          {#if playlist.missing}<span class="chip unavailable"><WarningIcon size={13} weight="fill" /> {playlist.missing} greyed out or removed</span>{/if}
          <span class="chip"><ClockIcon size={13} /> Synced {ago(playlist.lastSync)}</span>
        </div>
      </div>
    </div>
  </header>
  <div class="tabs glass" role="tablist">
    {#each TABS as [id, label, Icon] (id)}
      <button role="tab" aria-selected={store.tab === id} onclick={() => (store.tab = id)}><Icon size={18} weight={store.tab === id ? 'fill' : 'regular'} /> {label}</button>
    {/each}
  </div>
  <section class="panel">
    {#key store.tab}
      <div class="rise">
        {#if store.tab === 'items'}<ItemsTab />
        {:else if store.tab === 'short'}<ShortTab />
        {:else if store.tab === 'compare'}<CompareTab />
        {:else if store.tab === 'clean'}<CleanTab />
        {:else}<DupesTab />{/if}
      </div>
    {/key}
  </section>
{:else}
  <Home />
{/if}
