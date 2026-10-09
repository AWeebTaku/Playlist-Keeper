<script lang="ts">
  import { onMount } from 'svelte';
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

<div class="connect">
  <h1>Playlist Keeper</h1>
  <p class="mut" style="margin: 0 0 16px">Connect your YouTube Music account to track your playlists. Your login stays on this computer, in the system keychain.</p>

  <div class="card">
    <div class="stack">
      <strong>Use the account your browser is signed in to</strong>
      <span class="mut sm">Pick the browser where you are signed in to YouTube Music. Nothing is typed or sent anywhere except to YouTube.</span>
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
        <button class="btn primary" disabled={store.busy} onclick={() => store.signInBrowser(browser, profile || undefined)}>Use this account</button>
      </div>
      <span class="mut sm">Not signed in yet? <button class="btn sm ghost" onclick={() => void openYoutubeMusic()}>Open music.youtube.com</button> in your default browser, sign in there, then come back.</span>
    </div>

    <details>
      <summary class="mut sm" style="cursor: pointer">Paste a cookie instead</summary>
      <div class="stack" style="margin-top: 10px">
        <label for="paste" class="mut sm">For browsers that block other apps from reading cookies (for example Chrome on Windows). Copy the cookie header of any request to music.youtube.com.</label>
        <textarea id="paste" rows="3" bind:value={paste} placeholder="cookie: ..."></textarea>
        <button class="btn" disabled={store.busy || !paste.trim()} onclick={() => store.signInPasted(paste)}>Connect with pasted cookie</button>
      </div>
    </details>
    {#if store.connectError}<p class="err" role="alert" style="margin: 0">{store.connectError}</p>{/if}
  </div>
</div>
