<script lang="ts">
  import { onMount } from 'svelte';
  import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
  import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
  import Confirm from './Confirm.svelte';
  import Connect from './Connect.svelte';
  import Sidebar from './Sidebar.svelte';
  import Playlist from './Playlist.svelte';
  import { store } from './store.svelte';

  onMount(() => void store.boot());
</script>

{#if store.phase === 'boot'}
  <div class="connect-page"><div class="connect"><div class="skel"></div></div></div>
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
    <div class="toast" class:bad={t.bad}>
      {#if t.bad}<WarningCircleIcon size={20} weight="fill" />{:else}<CheckCircleIcon size={20} weight="fill" />{/if}
      <span>{t.text}</span>
    </div>
  {/each}
</div>
