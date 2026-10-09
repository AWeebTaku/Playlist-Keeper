<script lang="ts">
  import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
  import PlugsConnectedIcon from 'phosphor-svelte/lib/PlugsConnectedIcon';
  import { onMount } from 'svelte';
  import logo from '../assets/logo.png';
  import { browserChoices, openYoutubeMusic, profilesOf, type BrowserChoice } from '../services/auth';
  import type { BrowserProfile } from '../services/tauri';
  import { store } from './store.svelte';

  let choices = $state<BrowserChoice[]>([]);
  let browser = $state('firefox');
  let profiles = $state<BrowserProfile[]>([]);
  let profile = $state('');
  let paste = $state('');

  onMount(async () => {
    choices = await browserChoices();
    browser = choices[0]?.browser ?? 'firefox';
  });

  $effect(() => {
    const b = browser;
    void profilesOf(b).then((p) => {
      if (b !== browser) return;
      profiles = p;
      profile = p[0]?.id ?? '';
    });
  });
</script>

<div class="connect-page">
  <div class="connect">
    <div class="hero">
      <img src={logo} alt="" />
      <div>
        <h1>Playlist Keeper</h1>
        <div class="mut">Your YouTube Music playlists, remembered.</div>
      </div>
    </div>

    <div class="card">
      <div class="stack">
        <strong>Use the account your browser is signed in to</strong>
        <span class="mut sm">Pick the browser where you are signed in to YouTube Music. Your login stays on this computer, in the system keychain.</span>
        <div class="bar" style="margin: 0">
          <select bind:value={browser} aria-label="Browser">
            {#each choices as c (c.browser)}
              <option value={c.browser}>{c.browser}{c.isDefault ? ' (default)' : ''}</option>
            {/each}
          </select>
          {#if profiles.length > 1}
            <select bind:value={profile} aria-label="Profile">
              {#each profiles as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
            </select>
          {/if}
        </div>
        <button class="btn primary wide" style="min-height: 46px" disabled={store.busy} onclick={() => store.signInBrowser(browser, profile || undefined)}>
          <PlugsConnectedIcon size={20} weight="bold" /> {store.busy ? 'Connecting...' : 'Use this account'}
        </button>
        <span class="mut sm">
          Not signed in yet?
          <button class="btn sm ghost" onclick={() => void openYoutubeMusic()}><ArrowSquareOutIcon size={14} /> Open music.youtube.com</button>
          sign in there, then come back.
        </span>
      </div>

      <details>
        <summary class="mut sm" style="cursor: pointer">Paste a cookie instead</summary>
        <div class="stack" style="margin-top: 12px">
          <label for="paste" class="mut sm">For browsers that block other apps from reading cookies (for example Chrome on Windows). Copy the cookie header of any request to music.youtube.com.</label>
          <textarea id="paste" rows="3" bind:value={paste} placeholder="cookie: ..."></textarea>
          <button class="btn" disabled={store.busy || !paste.trim()} onclick={() => store.signInPasted(paste)}>Connect with pasted cookie</button>
        </div>
      </details>
      {#if store.connectError}<p class="err" role="alert" style="margin: 0">{store.connectError}</p>{/if}
    </div>
  </div>
</div>
