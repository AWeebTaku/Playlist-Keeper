<script lang="ts">
  import CleanTab from './CleanTab.svelte';
  import CompareTab from './CompareTab.svelte';
  import DupesTab from './DupesTab.svelte';
  import ItemsTab from './ItemsTab.svelte';
  import ShortTab from './ShortTab.svelte';
  import { store } from './store.svelte';

  const TABS = [
    ['items', 'Items'],
    ['short', 'Short tracks'],
    ['compare', 'Compare'],
    ['clean', 'Cleanup'],
    ['dupes', 'Duplicates'],
  ] as const;
  const playlist = $derived(store.playlists.find((p) => p.id === store.selected));
</script>

<div class="top">
  <h1>{playlist?.title ?? 'Pick a playlist'}</h1>
  <div class="meta">
    {#if playlist}{playlist.total} tracks{playlist.missing ? `, ${playlist.missing} greyed out or removed` : ''}{:else}Choose one from the list to begin.{/if}
  </div>
  {#if playlist}
    <div class="tabs" role="tablist">
      {#each TABS as [id, label] (id)}
        <button role="tab" aria-selected={store.tab === id} class:on={store.tab === id} onclick={() => (store.tab = id)}>{label}</button>
      {/each}
    </div>
  {/if}
</div>

{#if playlist}
  <section class="panel">
    {#if store.tab === 'items'}<ItemsTab />
    {:else if store.tab === 'short'}<ShortTab />
    {:else if store.tab === 'compare'}<CompareTab />
    {:else if store.tab === 'clean'}<CleanTab />
    {:else}<DupesTab />{/if}
  </section>
{/if}
