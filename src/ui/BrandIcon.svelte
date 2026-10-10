<script lang="ts">
  let { path, color, size = 20 }: { path: string; color: string; size?: number } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true" focusable="false"><path d={path} /></svg>
