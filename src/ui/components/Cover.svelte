<script lang="ts">
  import MusicNotesIcon from 'phosphor-svelte/lib/MusicNotesIcon';

  /** Candidate image URLs, best first; the next one is tried when one fails to load, then the icon. */
  let { srcs, iconSize = 22 }: { srcs: string[]; iconSize?: number } = $props();
  let failed = $state<string[]>([]);
  const src = $derived(srcs.find((s) => !failed.includes(s)) ?? null);
</script>

<span class="cover">
  {#if src}
    {#key src}<img {src} alt="" loading="lazy" onerror={() => (failed = [...failed, src])} />{/key}
  {:else}
    <MusicNotesIcon size={iconSize} weight="fill" />
  {/if}
</span>
