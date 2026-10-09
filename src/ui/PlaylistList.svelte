<script lang="ts">
  import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
  import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
  import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
  import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
  import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
  import type { PlaylistRow } from '../services/db';
  import Cover from './Cover.svelte';
  import { store } from './store.svelte';
  import { ago, coverUrls } from './util';

  const match = (p: PlaylistRow) => !store.query || p.title.toLowerCase().includes(store.query.toLowerCase());
  const shown = $derived(store.playlists.filter((p) => !p.hidden && match(p)));
  const hidden = $derived(store.playlists.filter((p) => p.hidden && match(p)));
  const view = $derived(store.playlistView);

  const open = (p: PlaylistRow) => void store.select(p.id);
  const key = (e: KeyboardEvent, p: PlaylistRow) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(p);
    }
  };
</script>

{#snippet hideButton(p: PlaylistRow)}
  <button class="btn icon sm ghost act" aria-label={p.hidden ? `Unhide ${p.title}` : `Hide ${p.title}`} title={p.hidden ? 'Unhide' : 'Hide'} onclick={(e) => { e.stopPropagation(); void store.toggleHidden(p); }}>
    {#if p.hidden}<EyeIcon size={16} />{:else}<EyeSlashIcon size={16} />{/if}
  </button>
{/snippet}

{#snippet row(p: PlaylistRow)}
  <div class="pl" class:on={p.id === store.selected} class:off={p.hidden} role="button" tabindex="0" onclick={() => open(p)} onkeydown={(e) => key(e, p)}>
    {#if view === 'compact'}
      <span class="x"><span class="t">{p.title}</span></span>
      <span class="s">
        {#if p.missing}<span class="badge" title="{p.missing} greyed out or removed">{p.missing}</span>{/if}
        {p.total}
      </span>
      {@render hideButton(p)}
    {:else if view === 'grid'}
      <Cover srcs={coverUrls(p)} iconSize={32} />
      {#if p.missing}<span class="badge corner" title="{p.missing} greyed out or removed">{p.missing}</span>{/if}
      {@render hideButton(p)}
      <span class="x">
        <div class="t">{p.title}</div>
        <div class="s">{p.total} tracks</div>
      </span>
    {:else if view === 'cards'}
      <Cover srcs={coverUrls(p)} iconSize={26} />
      <span class="x">
        <div class="t">{p.title}</div>
        <div class="s"><span>{p.total} tracks</span>{#if p.missing}<span class="chip unavailable"><WarningIcon size={12} weight="fill" />{p.missing} lost</span>{/if}</div>
        <div class="s">Synced {ago(p.lastSync)}</div>
      </span>
      {@render hideButton(p)}
    {:else}
      <Cover srcs={coverUrls(p)} />
      <span class="x">
        <div class="t">{p.title}</div>
        <div class="s"><span>{p.total} tracks</span>{#if p.missing}<span class="badge" title="{p.missing} greyed out or removed">{p.missing}</span>{/if}</div>
      </span>
      {@render hideButton(p)}
    {/if}
  </div>
{/snippet}

{#snippet section(id: 'playlists' | 'hidden', title: string, list: PlaylistRow[])}
  <section class:sec-hidden={id === 'hidden'}>
    <button class="sec-head" aria-expanded={!store.collapsed[id]} onclick={() => store.toggleSection(id)}>
      {#if store.collapsed[id]}<CaretRightIcon size={14} weight="bold" />{:else}<CaretDownIcon size={14} weight="bold" />{/if}
      {title}
      <span class="n">{list.length}</span>
    </button>
    {#if !store.collapsed[id]}
      <div class="pl-{view}">
        {#each list as p (p.id)}{@render row(p)}{:else}<div class="empty" style="margin: 6px 0; padding: 18px 12px">{id === 'hidden' ? 'Nothing hidden.' : store.query ? 'No playlist matches.' : 'No playlists yet. Press Sync all.'}</div>{/each}
      </div>
    {/if}
  </section>
{/snippet}

<div class="pls">
  {@render section('playlists', 'Playlists', shown)}
  {#if store.showHidden}{@render section('hidden', 'Hidden', hidden)}{/if}
</div>
