<script lang="ts">
  import type { Profile } from '../services/parse';

  let { profile, large = false }: { profile: Profile | null; large?: boolean } = $props();
  let failed = $state<string | null>(null);
  const initial = $derived((profile?.name ?? '?').trim().charAt(0).toUpperCase() || '?');
</script>

<span class="avatar" class:lg={large} aria-hidden="true">
  {initial}
  {#if profile?.photo && failed !== profile.photo}
    <img src={profile.photo} alt="" referrerpolicy="no-referrer" onerror={() => (failed = profile?.photo ?? null)} />
  {/if}
</span>
