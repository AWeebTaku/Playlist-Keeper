<script lang="ts">
  import { onMount } from 'svelte';
  import Confirm from './Confirm.svelte';
  import Connect from './Connect.svelte';
  import Sidebar from './Sidebar.svelte';
  import Playlist from './Playlist.svelte';
  import { store } from './store.svelte';

  onMount(() => void store.boot());
</script>

{#if store.phase === 'boot'}
  <div class="connect"><div class="skel"></div></div>
{:else if store.phase === 'connect'}
  <Connect />
{:else}
  <div class="shell">
    <Sidebar />
    <main><Playlist /></main>
  </div>
{/if}

<Confirm />

<div id="toasts" aria-live="polite">
  {#each store.toasts as t (t.id)}
    <div class="toast" class:bad={t.bad}>{t.text}</div>
  {/each}
</div>
