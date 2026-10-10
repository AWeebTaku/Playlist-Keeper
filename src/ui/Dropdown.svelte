<script lang="ts">
  import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
  import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
  import BrandIcon from './BrandIcon.svelte';
  import type { DropdownOption } from './dropdown';

  /** A select that looks like the rest of the app. Keyboard: arrows, Home, End, Enter or Space to choose, Escape to close. */
  let { options, value = $bindable(''), label, width = '100%' }: { options: DropdownOption[]; value: string; label: string; width?: string } = $props();

  let open = $state(import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('ddopen')); // dev-only: lets screenshots show the open list
  let active = $state(0);
  let root = $state<HTMLElement>();
  const id = `dd-${Math.random().toString(36).slice(2, 8)}`;
  const current = $derived(options.find((o) => o.value === value));

  function show() {
    active = Math.max(0, options.findIndex((o) => o.value === value));
    open = true;
  }
  function pick(v: string) {
    value = v;
    open = false;
    root?.querySelector<HTMLElement>('.dd-btn')?.focus();
  }
  function onkey(e: KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const n = options.length;
    if (e.key === 'Escape') open = false;
    else if (e.key === 'ArrowDown') active = (active + 1) % n;
    else if (e.key === 'ArrowUp') active = (active - 1 + n) % n;
    else if (e.key === 'Home') active = 0;
    else if (e.key === 'End') active = n - 1;
    else if (e.key === 'Enter' || e.key === ' ') pick(options[active]!.value);
    else if (e.key === 'Tab') {
      open = false;
      return;
    } else return;
    e.preventDefault();
  }
</script>

{#snippet logo(o: DropdownOption)}
  {#if o.img}<img src={o.img} alt="" width="20" height="20" />{:else if o.brand}<BrandIcon path={o.brand.path} color={o.brand.hex} />{:else if o.icon}{@const Ico = o.icon}<Ico size={20} />{/if}
{/snippet}

<svelte:window onclick={(e) => open && root && !root.contains(e.target as Node) && (open = false)} />

<div class="dd" bind:this={root} style:width>
  <button type="button" class="dd-btn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-activedescendant={open ? `${id}-${active}` : undefined} aria-label={label} onclick={() => (open ? (open = false) : show())} onkeydown={onkey}>
    {#if current}{@render logo(current)}{/if}
    <span class="dd-text">{current?.label ?? 'Choose...'}</span>
    {#if current?.badge}<span class="chip">{current.badge}</span>{/if}
    <span class="dd-caret" class:flip={open}><CaretDownIcon size={14} weight="bold" /></span>
  </button>
  {#if open}
    <div class="dd-menu" role="listbox" {id} aria-label={label}>
      {#each options as o, i (o.value)}
        <button type="button" tabindex="-1" role="option" id="{id}-{i}" aria-selected={o.value === value} class="dd-opt" class:active={i === active} onmouseenter={() => (active = i)} onclick={() => pick(o.value)}>
          {@render logo(o)}
          <span class="dd-text">{o.label}</span>
          {#if o.badge}<span class="chip">{o.badge}</span>{/if}
          {#if o.value === value}<CheckIcon size={16} weight="bold" />{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
