<script lang="ts">
  import type { Snippet } from 'svelte';
  import { hideBroken, mmss, thumb } from '../state/util';

  let { videoId, title, subtitle, duration, index, children }: { videoId: string; title: string; subtitle: string; duration: number | null; index?: number | string; children?: Snippet } = $props();
</script>

<div class="row">
  {#if index !== undefined}<span class="idx">{index}</span>{/if}
  <img class="th" loading="lazy" src={thumb(videoId)} alt="" onerror={hideBroken} />
  <div class="x">
    <div class="t1" {title}>{title}</div>
    <div class="t2">{subtitle}</div>
  </div>
  <span class="dur">{mmss(duration)}</span>
  {@render children?.()}
</div>
