<script lang="ts">
  import { store } from './store.svelte';

  const rows = $derived(store.playlists.filter((p) => (store.showHidden || !p.hidden) && (!store.query || p.title.toLowerCase().includes(store.query.toLowerCase()))));
  const nextTheme = () => store.setTheme(store.theme === 'system' ? 'dark' : store.theme === 'dark' ? 'light' : 'system');
</script>

<aside>
  <div class="brand">
    <span>Playlist Keeper</span>
    <button class="btn sm ghost" onclick={nextTheme} title="Theme: {store.theme}">Theme: {store.theme}</button>
  </div>
  <div class="side-tools">
    <input type="search" placeholder="Search playlists" aria-label="Search playlists" bind:value={store.query} />
    <div class="bar" style="margin: 0">
      <button class="btn primary" disabled={store.sync.running} onclick={() => store.runSync()}>Sync all</button>
      <button class="btn sm ghost" onclick={() => store.reconnect()}>Reconnect</button>
    </div>
    <div class="mut sm" style="min-height: 18px" aria-live="polite">
      {#if store.sync.running}Syncing {store.sync.done} of {store.sync.total}{store.sync.active.length ? ': ' + store.sync.active.join(', ') : ''}{:else}{store.sync.note}{/if}
    </div>
    <label class="mut sm"><input type="checkbox" bind:checked={store.showHidden} /> Show hidden playlists</label>
    {#if store.update}
      <div class="notice" role="status">
        <strong>Version {store.update.version} is available</strong>
        <button class="btn sm primary" disabled={store.updateState === 'installing'} onclick={() => store.installUpdate()}>
          {store.updateState === 'installing' ? `Installing${store.updatePct !== null ? ` ${store.updatePct}%` : '...'}` : 'Install and restart'}
        </button>
      </div>
    {:else}
      <button class="btn sm ghost" style="justify-self: start" disabled={store.updateState !== 'idle'} onclick={() => store.checkUpdate()}>{store.updateState === 'checking' ? 'Checking...' : 'Check for updates'}</button>
    {/if}
  </div>
  <div class="pls">
    {#each rows as p (p.id)}
      <div class="pl" class:on={p.id === store.selected} class:off={p.hidden} role="button" tabindex="0" onclick={() => store.select(p.id)} onkeydown={(e) => e.key === 'Enter' && store.select(p.id)}>
        <span class="t">{p.title}</span>
        {#if p.missing}<span class="pill" title="Greyed out or removed">{p.missing}</span>{/if}
        <span class="n">{p.total}</span>
        <button class="btn sm ghost hb" onclick={(e) => { e.stopPropagation(); void store.toggleHidden(p); }}>{p.hidden ? 'Unhide' : 'Hide'}</button>
      </div>
    {:else}
      <div class="empty">No playlists yet. Press Sync all.</div>
    {/each}
  </div>
</aside>
