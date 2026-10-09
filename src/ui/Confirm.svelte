<script lang="ts">
  import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
  import { store } from './store.svelte';

  const d = $derived(store.dialog);
  let okButton = $state<HTMLButtonElement>();
  $effect(() => {
    if (d) okButton?.focus();
  });
</script>

<svelte:window onkeydown={(e) => d && e.key === 'Escape' && store.answer(false)} />

{#if d}
  <div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && store.answer(false)}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label={d.title}>
      <h3>{d.title}</h3>
      <div class="body">{d.body}</div>
      <div class="acts">
        <button class="btn" onclick={() => store.answer(false)}>Cancel</button>
        <button class="btn {d.danger ? 'danger' : 'primary'}" bind:this={okButton} onclick={() => store.answer(true)}>{#if d.danger}<TrashIcon size={16} weight="bold" />{/if}{d.ok}</button>
      </div>
    </div>
  </div>
{/if}
