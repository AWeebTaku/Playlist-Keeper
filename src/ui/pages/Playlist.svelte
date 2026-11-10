<script lang="ts">
  import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
  import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
  import MusicNotesIcon from 'phosphor-svelte/lib/MusicNotesIcon';
  import SparkleIcon from 'phosphor-svelte/lib/SparkleIcon';
  import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
  import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
  import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
  import CleanTab from '../tabs/CleanTab.svelte';
  import Combine from './Combine.svelte';
  import Compare from './Compare.svelte';
  import Cover from '../components/Cover.svelte';
  import DupesTab from '../tabs/DupesTab.svelte';
  import Home from './Home.svelte';
  import ItemsTab from '../tabs/ItemsTab.svelte';
  import ProfileMenu from '../shell/ProfileMenu.svelte';
  import TaskCenter from '../shell/TaskCenter.svelte';
  import { store } from '../state/store.svelte';
  import { ago, coverUrls } from '../state/util';

  const TABS = [
    ['items', 'Items', MusicNotesIcon],
    ['clean', 'Cleanup', SparkleIcon],
    ['dupes', 'Duplicates', CopyIcon],
  ] as const;
  const playlist = $derived(store.playlists.find((p) => p.id === store.selected));
  const covers = $derived(playlist ? coverUrls(playlist) : []);
</script>

<div class="topbar glass">
  <span class="where">{store.combine ? 'Combine' : store.compare ? 'Compare' : playlist ? 'Playlist' : 'Home'}</span>
  <span class="top-end"><TaskCenter /><ProfileMenu /></span>
</div>

{#if store.combine}
  <section class="panel"><Combine /></section>
{:else if store.compare}
  <section class="panel"><Compare /></section>
{:else if playlist}
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
      <div class="banner-actions">
        <button class="btn sm outline" title="Add songs from a JSON file to this playlist" onclick={() => store.importIntoPlaylist(playlist.id)}><UploadSimpleIcon size={16} /> Import</button>
        <button class="btn sm outline" title="Save this playlist to a JSON file" onclick={() => store.exportPlaylists([playlist.id])}><DownloadSimpleIcon size={16} /> Export</button>
        <button class="btn sm outline" title="Save this playlist as a spreadsheet (CSV)" onclick={() => store.exportPlaylists([playlist.id], 'csv')}><DownloadSimpleIcon size={16} /> CSV</button>
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
        {:else if store.tab === 'clean'}<CleanTab />
        {:else}<DupesTab />{/if}
      </div>
    {/key}
  </section>
{:else}
  <Home />
{/if}
