<script lang="ts">
  import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
  import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
  import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
  import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
  import XIcon from 'phosphor-svelte/lib/XIcon';
  import { tasks, type Task } from '../state/tasks.svelte';

  let open = $state(import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('tasksopen'));
  let button = $state<HTMLButtonElement>();

  const running = $derived(tasks.running);
  const unseen = $derived(tasks.unseen);
  const failed = $derived(tasks.list.some((t) => t.state === 'failed' && !t.seen));
  const first = $derived(running[0]);
  const pct = (t: Task) => (t.total ? Math.min(100, Math.round((t.done / t.total) * 100)) : 0);
  const label = $derived(running.length ? (running.length > 1 ? `${running.length} tasks running` : (first?.title ?? 'Running')) : failed ? 'Needs a look' : 'Finished');

  function toggle() {
    open = !open;
    if (open) tasks.markSeen();
  }
  function go(t: Task) {
    open = false;
    t.open();
  }
  const close = (refocus = false) => {
    open = false;
    if (refocus) button?.focus();
  };
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close(true)} onclick={(e) => open && !(e.target as Element).closest('[data-tasks]') && close()} />

{#if tasks.list.length}
  <span data-tasks class="tasks">
    <button class="task-btn" class:busy={running.length > 0} class:bad={!running.length && failed} bind:this={button} aria-haspopup="dialog" aria-expanded={open} aria-label="Background tasks: {label}" onclick={toggle}>
      {#if running.length}
        <span class="spin ico"><CircleNotchIcon size={16} weight="bold" /></span>
      {:else if failed}
        <WarningCircleIcon size={16} weight="fill" />
      {:else}
        <CheckCircleIcon size={16} weight="fill" />
      {/if}
      <span class="lbl">{label}</span>
      {#if running.length === 1 && first?.total}<span class="pct">{pct(first)}%</span>{/if}
      {#if !running.length && unseen.length}<span class="dot" aria-hidden="true"></span>{/if}
    </button>

    {#if open}
      <div class="popover tasks-pop" role="dialog" aria-label="Background tasks">
        <div class="menu-label" style="margin-top: 0">Tasks</div>
        <ul>
          {#each tasks.list as t (t.id)}
            <li class={t.state}>
              <span class="st" aria-hidden="true">
                {#if t.state === 'running'}<span class="spin ico"><CircleNotchIcon size={18} weight="bold" /></span>{:else if t.state === 'done'}<CheckCircleIcon size={18} weight="fill" />{:else}<WarningCircleIcon size={18} weight="fill" />{/if}
              </span>
              <span class="x">
                <span class="t1">{t.title}</span>
                <span class="t2" title={t.detail}>{t.state === 'running' ? t.detail : t.state === 'done' ? `Done. ${t.detail}` : t.detail}</span>
                {#if t.state === 'running' && t.total}<span class="meter thin" style:--p="{pct(t)}%"><span></span></span>{/if}
              </span>
              <button class="btn sm outline" onclick={() => go(t)}>Open <ArrowRightIcon size={14} /></button>
              {#if t.state !== 'running'}<button class="btn icon sm ghost" aria-label="Dismiss {t.title}" onclick={() => tasks.dismiss(t.id)}><XIcon size={14} /></button>{/if}
            </li>
          {/each}
        </ul>
        {#if tasks.list.some((t) => t.state !== 'running')}<button class="btn sm ghost" style="margin-top: 8px" onclick={() => tasks.clearFinished()}>Clear finished</button>{/if}
      </div>
    {/if}
  </span>
{/if}
