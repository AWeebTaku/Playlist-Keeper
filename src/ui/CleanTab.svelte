<script lang="ts">
  import { store } from './store.svelte';

  let changedOnly = $state(true);
  const LIMIT = 300;
  const rows = $derived(store.items.filter((i) => i.cleanTitle && (!changedOnly || i.cleanTitle !== i.title || (i.cleanArtist ?? '') !== i.artists)));

  async function save(videoId: string, value: string) {
    const { repo } = await store.ctx();
    const ok = await store.attempt(async () => (await repo.setOverride(videoId, value), true));
    if (ok) {
      store.toast('Saved');
      store.items = await repo.items(store.selected!);
    }
  }
</script>

<p class="hint">Cleaned names are kept in this app only, because YouTube cannot rename other people's videos. Edit a name and press Enter to save it. Clear it to go back to the automatic one. Words like remix, cover and slowed are kept so different versions stay different.</p>
<div class="bar"><label class="switch"><input type="checkbox" bind:checked={changedOnly} /> Only names that changed</label></div>

{#if rows.length}
  <div class="card" style="overflow: auto; padding: 0">
    <table>
      <thead><tr><th>Original</th><th>Cleaned name (editable)</th><th>Kept tags</th></tr></thead>
      <tbody>
        {#each rows.slice(0, LIMIT) as i (i.videoId)}
          <tr>
            <td class="t2" style="max-width: 340px">{i.artists} - {i.title}</td>
            <td><input type="text" size="44" value={i.cleanTitle} aria-label="Cleaned name" onchange={(e) => save(i.videoId, e.currentTarget.value)} /></td>
            <td class="t2">{i.tags}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if rows.length > LIMIT}<p class="mut">Showing {LIMIT} of {rows.length}.</p>{/if}
{:else}
  <div class="empty">Nothing to clean here.</div>
{/if}
