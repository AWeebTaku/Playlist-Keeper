<script lang="ts">
  import { onMount } from 'svelte';
  import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
  import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
  import { fly } from 'svelte/transition';
  import About from './About.svelte';
  import Confirm from './Confirm.svelte';
  import Connect from './Connect.svelte';
  import Sidebar from './Sidebar.svelte';
  import Playlist from './Playlist.svelte';
  import { store } from './store.svelte';

  onMount(() => void store.boot());
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && store.canGoBack && store.cancelReconnect()} />

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

{#if store.phase === 'ready' && store.profileOpen}
  <div class="menu-scrim" role="presentation" onclick={() => (store.profileOpen = false)}></div>
{/if}

{#if store.phase === 'ready' && store.canGoBack}
  <div class="scrim lite" role="presentation" onclick={(e) => e.target === e.currentTarget && store.cancelReconnect()}>
    <div class="connect-modal"><Connect modal /></div>
  </div>
{/if}

<About />
<Confirm />

<div id="toasts" aria-live="polite">
  {#each store.toasts as t (t.id)}
    <div class="toast" class:bad={t.bad} in:fly={{ x: 40, duration: 220 }} out:fly={{ x: 40, duration: 160 }}>
      {#if t.bad}<WarningCircleIcon size={20} weight="fill" />{:else}<CheckCircleIcon size={20} weight="fill" />{/if}
      <span>{t.text}</span>
    </div>
  {/each}
</div>
