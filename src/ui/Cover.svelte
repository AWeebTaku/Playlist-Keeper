<script lang="ts">
  import MusicNotesIcon from 'phosphor-svelte/lib/MusicNotesIcon';

  let { src, iconSize = 22 }: { src: string | null; iconSize?: number } = $props();
  let failed = $state<string | null>(null);
</script>

<span class="cover">
  {#if src && failed !== src}
    <img {src} alt="" loading="lazy" onerror={() => (failed = src)} />
  {:else}
    <MusicNotesIcon size={iconSize} weight="fill" />
  {/if}
</span>
