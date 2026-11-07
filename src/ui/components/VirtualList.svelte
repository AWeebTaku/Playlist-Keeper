<script lang="ts" generics="T">
  /**
   * Renders only the rows near the viewport, so a playlist of thousands of songs scrolls smoothly while every song is still
   * there. Row heights may differ (an opened result panel makes a row taller): each rendered row is measured and the
   * measurement is remembered by key. Scrolls with the nearest scrolling ancestor (the page's main area).
   */
  import { onMount, type Snippet } from 'svelte';

  let { items, key, row, estimate = 62, gap = 0 }: { items: T[]; key: (x: T) => string; row: Snippet<[T, number]>; estimate?: number; gap?: number } = $props();

  /** Pixels rendered above and below the visible part. */
  const OVERSCAN = 700;

  let host = $state<HTMLDivElement>();
  let view = $state({ start: 0, end: 40, before: 0, after: 0 });
  /** Measured heights by key. Plain object on purpose: it is a cache, and changing it must not re-render by itself. */
  const sizes: Record<string, number> = {};
  let scroller: HTMLElement | null = null;
  let queued = false;

  function recalc() {
    queued = false;
    if (!host) return;
    const top = scroller ? scroller.scrollTop : window.scrollY;
    const height = scroller ? scroller.clientHeight : window.innerHeight;
    const hostTop = host.getBoundingClientRect().top - (scroller ? scroller.getBoundingClientRect().top : 0) + top;
    const from = top - hostTop - OVERSCAN;
    const to = top - hostTop + height + OVERSCAN;
    let y = 0;
    let start = items.length;
    let before = -1;
    let end = 0;
    let endY = 0;
    for (let i = 0; i < items.length; i++) {
      const h = sizes[key(items[i]!)] ?? estimate;
      if (before < 0 && y + h > from) {
        start = i;
        before = y;
      }
      if (y <= to) {
        end = i + 1;
        endY = y + h;
      }
      y += h;
    }
    if (before < 0) before = y;
    if (end < start) end = start;
    const next = { start, end, before, after: Math.max(0, y - endY) };
    if (next.start !== view.start || next.end !== view.end || next.before !== view.before || next.after !== view.after) view = next;
  }

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(recalc);
  };

  function measure(node: HTMLElement, id: string) {
    let current = id;
    const ro = new ResizeObserver(() => {
      const h = node.offsetHeight;
      if (h && sizes[current] !== h) {
        sizes[current] = h;
        schedule();
      }
    });
    ro.observe(node);
    return { update: (next: string) => (current = next), destroy: () => ro.disconnect() };
  }

  function scrollParent(el: HTMLElement | null): HTMLElement | null {
    for (let p = el?.parentElement; p; p = p.parentElement) if (/(auto|scroll)/u.test(getComputedStyle(p).overflowY)) return p;
    return null;
  }

  onMount(() => {
    scroller = scrollParent(host ?? null);
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    recalc();
    return () => {
      target.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  });

  // a new list (filtered, sorted, reloaded) is laid out again
  $effect(() => {
    void items;
    void items.length;
    recalc();
  });
</script>

<div bind:this={host} class="vlist" style:padding-top="{view.before}px" style:padding-bottom="{view.after}px">
  {#each items.slice(view.start, view.end) as item, n (key(item))}
    <div class="vrow" style:padding-bottom="{gap}px" use:measure={key(item)}>{@render row(item, view.start + n)}</div>
  {/each}
</div>

<style>
  .vlist {
    overflow-anchor: none;
  }
</style>
