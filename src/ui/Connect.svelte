<script lang="ts">
  import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
  import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
  import PlugsConnectedIcon from 'phosphor-svelte/lib/PlugsConnectedIcon';
  import { onMount } from 'svelte';
  import logo from '../assets/logo.png';
  import { browserChoices, openYoutubeMusic, profilesOf, type BrowserChoice } from '../services/auth';
  import type { BrowserProfile } from '../services/tauri';
  import { browserOption } from './browsers';
  import Dropdown from './Dropdown.svelte';
  import type { DropdownOption } from './dropdown';
  import { store } from './store.svelte';

  let { modal = false }: { modal?: boolean } = $props();
  let choices = $state<BrowserChoice[]>([]);
  let browser = $state('firefox');
  let profiles = $state<BrowserProfile[]>([]);
  let profile = $state('');
  let paste = $state('');
  const browserOptions = $derived<DropdownOption[]>(choices.map((c) => browserOption(c.browser, c.isDefault)));
  const profileOptions = $derived<DropdownOption[]>(profiles.map((p) => ({ value: p.id, label: p.label })));

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

<div class={modal ? '' : 'connect-page'}>
  <div class="connect">
    {#if store.canGoBack}
      <button class="btn sm ghost" style="margin-bottom: 12px" onclick={() => store.cancelReconnect()}><ArrowLeftIcon size={14} weight="bold" /> Back to the app</button>
    {/if}
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
        <div class="bar" style="margin: 0; flex-wrap: nowrap">
          <Dropdown label="Browser" options={browserOptions} bind:value={browser} width={profiles.length > 1 ? '55%' : '100%'} />
          {#if profiles.length > 1}<Dropdown label="Profile" options={profileOptions} bind:value={profile} width="45%" />{/if}
        </div>
        <button class="btn primary wide" style="min-height: 46px" disabled={store.busy} onclick={() => store.signInBrowser(browser, profile || undefined)}>
          <PlugsConnectedIcon size={20} weight="bold" /> {store.busy ? 'Connecting...' : 'Use this account'}
        </button>
        <span class="mut sm">Not signed in yet? Sign in at <button class="link" onclick={() => void openYoutubeMusic()}>YouTube Music</button> first, then come back and press the button above.</span>
      </div>

      <details class="alt" open={import.meta.env.DEV && location.search.includes('pasteopen')}>
        <summary><CaretRightIcon size={14} weight="bold" /> Paste a cookie instead</summary>
        <div class="body">
          <label for="paste" class="mut sm">For browsers that block other apps from reading cookies (for example Chrome on Windows). Copy the cookie header of any request to music.youtube.com.</label>
          <textarea id="paste" bind:value={paste} placeholder="cookie: ..." spellcheck="false"></textarea>
          <div class="bar"><button class="btn sm outline" disabled={store.busy || !paste.trim()} onclick={() => store.signInPasted(paste)}>Connect with pasted cookie</button></div>
        </div>
      </details>
      {#if store.connectError}<p class="err" role="alert" style="margin: 0">{store.connectError}</p>{/if}
    </div>
  </div>
</div>
