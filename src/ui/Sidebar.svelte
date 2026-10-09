<script lang="ts">
  import ArrowsClockwiseIcon from 'phosphor-svelte/lib/ArrowsClockwiseIcon';
  import CardsIcon from 'phosphor-svelte/lib/CardsIcon';
  import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
  import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
  import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
  import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
  import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
  import ListDashesIcon from 'phosphor-svelte/lib/ListDashesIcon';
  import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
  import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
  import logo from '../assets/logo.png';
  import PlaylistList from './PlaylistList.svelte';
  import Segmented from './Segmented.svelte';
  import { store } from './store.svelte';

  const VIEWS = [
    { value: 'list', title: 'List with covers', icon: ListBulletsIcon },
    { value: 'grid', title: 'Cover grid', icon: SquaresFourIcon },
    { value: 'compact', title: 'Compact list', icon: ListDashesIcon },
    { value: 'cards', title: 'Detailed cards', icon: CardsIcon },
  ] as const;
  const hiddenCount = $derived(store.playlists.filter((p) => p.hidden).length);
  const pct = $derived(store.sync.total ? Math.round((store.sync.done / store.sync.total) * 100) : 0);
</script>

<aside class="side">
  <div class="brand"><button class="brand-btn" onclick={() => store.goHome()} aria-label="Playlist Keeper home"><img src={logo} alt="" width="30" height="30" style="border-radius: 8px" /> Playlist Keeper</button></div>
  <div class="side-tools">
    <button class="btn primary sync" style:--p="{store.sync.running ? pct : 0}%" disabled={store.sync.running} onclick={() => store.runSync()}>
      <span class="fill"></span>
      <span>
        {#if store.sync.running}
          <span class="spin ico"><CircleNotchIcon size={20} weight="bold" /></span> Syncing {store.sync.done} of {store.sync.total}
        {:else}
          <ArrowsClockwiseIcon size={20} weight="bold" /> Sync all
        {/if}
      </span>
    </button>
    <div class="sync-note" aria-live="polite" title={store.sync.running ? store.sync.active.join(', ') : store.sync.note}>
      {#if store.sync.running}{store.sync.active.join(', ')}{:else}{store.sync.note}{/if}
    </div>
    <label class="search">
      <span class="ico"><MagnifyingGlassIcon size={18} /></span>
      <input type="search" placeholder="Search playlists" aria-label="Search playlists" bind:value={store.query} />
    </label>
    <div class="view-row">
      <Segmented compact label="Playlist layout" options={[...VIEWS]} value={store.playlistView} onchange={(v) => store.setPlaylistView(v)} />
      <button class="btn toggle" aria-pressed={store.showHidden} title="{store.showHidden ? 'Hide' : 'Show'} hidden playlists ({hiddenCount})" onclick={() => (store.showHidden = !store.showHidden)}>
        {#if store.showHidden}<EyeIcon size={16} weight="fill" />{:else}<EyeSlashIcon size={16} />{/if}
        Hidden <span class="n">{hiddenCount}</span>
      </button>
    </div>
  </div>
  <button class="nav-home" class:on={store.selected === null} style="margin: 0 10px 2px; width: calc(100% - 20px)" onclick={() => store.goHome()}><HouseIcon size={20} weight={store.selected === null ? 'fill' : 'regular'} /> Home</button>
  <PlaylistList />
</aside>
