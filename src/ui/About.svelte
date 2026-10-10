<script lang="ts">
  import GithubLogoIcon from 'phosphor-svelte/lib/GithubLogoIcon';
  import GlobeIcon from 'phosphor-svelte/lib/GlobeIcon';
  import logo from '../assets/logo.png';
  import { store } from './store.svelte';
</script>

<svelte:window onkeydown={(e) => store.aboutOpen && e.key === 'Escape' && (store.aboutOpen = false)} />

{#if store.aboutOpen}
  <div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && (store.aboutOpen = false)}>
    <div class="sheet about" role="dialog" aria-modal="true" aria-label="About Playlist Keeper">
      <img src={logo} alt="" width="64" height="64" />
      <h3>Playlist Keeper</h3>
      <div class="mut sm">{store.appVersion ? `Version ${store.appVersion}` : ''}</div>
      <p class="mut">Keeps a local history of your YouTube Music playlists, so removed and greyed-out songs are never lost.</p>
      <div class="stack">
        <button class="btn" disabled={!store.repoUrl} onclick={() => store.openLink(store.repoUrl)}><GithubLogoIcon size={18} /> View on GitHub</button>
        <button class="btn" disabled={!store.website} onclick={() => store.openLink(store.website)}><GlobeIcon size={18} /> Website (coming soon)</button>
        <button class="btn primary" onclick={() => (store.aboutOpen = false)}>Close</button>
      </div>
    </div>
  </div>
{/if}
