<script lang="ts">
  import ArrowCircleUpIcon from 'phosphor-svelte/lib/ArrowCircleUpIcon';
  import ArrowsClockwiseIcon from 'phosphor-svelte/lib/ArrowsClockwiseIcon';
  import DesktopIcon from 'phosphor-svelte/lib/DesktopIcon';
  import MoonIcon from 'phosphor-svelte/lib/MoonIcon';
  import PlugsConnectedIcon from 'phosphor-svelte/lib/PlugsConnectedIcon';
  import SignOutIcon from 'phosphor-svelte/lib/SignOutIcon';
  import SunIcon from 'phosphor-svelte/lib/SunIcon';
  import Avatar from './Avatar.svelte';
  import Segmented from './Segmented.svelte';
  import { store } from './store.svelte';

  let button = $state<HTMLButtonElement>();
  const THEMES = [
    { value: 'system', label: 'System', title: 'Follow the system theme', icon: DesktopIcon },
    { value: 'light', label: 'Light', title: 'Light theme', icon: SunIcon },
    { value: 'dark', label: 'Dark', title: 'Dark theme', icon: MoonIcon },
  ] as const;

  function close(refocus = false) {
    store.profileOpen = false;
    if (refocus) button?.focus();
  }
</script>

<svelte:window
  onkeydown={(e) => store.profileOpen && e.key === 'Escape' && close(true)}
  onclick={(e) => store.profileOpen && !(e.target as Element).closest('[data-profile]') && close()}
/>

<span data-profile>
  <button class="avatar-btn" bind:this={button} aria-haspopup="dialog" aria-expanded={store.profileOpen} aria-label="Account menu" title={store.profile?.name ?? 'Account'} onclick={() => (store.profileOpen = !store.profileOpen)}>
    <Avatar profile={store.profile} />
  </button>

  {#if store.profileOpen}
    <div class="popover" role="dialog" aria-label="Account">
      <div class="who">
        <Avatar profile={store.profile} large />
        <div style="min-width: 0">
          <div class="name t1">{store.profile?.name ?? 'Signed in'}</div>
          {#if store.profile?.handle}<div class="t2">{store.profile.handle}</div>{/if}
        </div>
      </div>

      <div class="menu-label">Theme</div>
      <Segmented full label="Theme" options={[...THEMES]} value={store.theme} onchange={(v) => store.setTheme(v)} />

      <div class="menu-label">Account and app</div>
      {#if store.update}
        <button class="menu-row accent" disabled={store.updateState === 'installing'} onclick={() => store.installUpdate()}>
          <ArrowCircleUpIcon size={22} weight="fill" />
          <span>
            <div>Version {store.update.version} is available</div>
            <div class="msub">{store.updateState === 'installing' ? `Installing${store.updatePct !== null ? ` ${store.updatePct}%` : '...'}` : 'Install and restart'}</div>
          </span>
        </button>
      {:else}
        <button class="menu-row" disabled={store.updateState !== 'idle'} onclick={() => store.checkUpdate()}>
          <span class:spin={store.updateState === 'checking'} class="ico"><ArrowsClockwiseIcon size={22} /></span>
          <span>
            <div>Check for updates</div>
            <div class="msub">{store.updateState === 'checking' ? 'Checking...' : store.appVersion ? `You have version ${store.appVersion}` : 'Look for a newer version'}</div>
          </span>
        </button>
      {/if}
      <button class="menu-row" onclick={() => store.reconnect()}>
        <PlugsConnectedIcon size={22} />
        <span>
          <div>Reconnect</div>
          <div class="msub">Use another browser or account</div>
        </span>
      </button>
      <button class="menu-row" onclick={() => store.logout()}>
        <SignOutIcon size={22} />
        <span>
          <div>Log out</div>
          <div class="msub">Remove the saved login from this computer</div>
        </span>
      </button>

      <div class="menu-foot">Playlist Keeper{store.appVersion ? ` ${store.appVersion}` : ''}</div>
    </div>
  {/if}
</span>
