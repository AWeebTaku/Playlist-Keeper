<script lang="ts" generics="T extends string">
  import type { Component } from 'svelte';

  interface Option {
    value: T;
    label?: string;
    title: string;
    icon: Component<{ size?: number | string; weight?: 'regular' | 'fill' | 'bold' }>;
  }
  let { options, value, onchange, label, full = false, compact = false }: { options: Option[]; value: T; onchange: (v: T) => void; label: string; full?: boolean; compact?: boolean } = $props();
</script>

<div class="seg" class:full class:compact role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    {@const Icon = o.icon}
    <button type="button" role="radio" aria-checked={o.value === value} title={o.title} aria-label={o.label ? undefined : o.title} onclick={() => onchange(o.value)}>
      <Icon size={16} weight={o.value === value ? 'fill' : 'regular'} />
      {#if o.label}<span>{o.label}</span>{/if}
    </button>
  {/each}
</div>
