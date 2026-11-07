import { describe, expect, it } from 'vitest';
import { tasks } from './tasks.svelte';

describe('background tasks', () => {
  it('tracks progress, completion, what the user has seen, and dismissal', () => {
    tasks.clearFinished();
    let opened = 0;
    const a = tasks.start({ title: 'A', open: () => opened++ });
    const b = tasks.start({ title: 'B', open: () => undefined, total: 10 });
    expect(tasks.running.map((t) => t.title)).toEqual(['B', 'A']); // newest first
    tasks.patch(b, { done: 4, detail: '4 of 10' });
    expect(tasks.list.find((t) => t.id === b)).toMatchObject({ done: 4, detail: '4 of 10', state: 'running' });
    tasks.list.find((t) => t.id === a)!.open();
    expect(opened).toBe(1);

    tasks.finish(b, 'done', 'all copied');
    expect(tasks.list.find((t) => t.id === b)).toMatchObject({ state: 'done', done: 10, detail: 'all copied' });
    tasks.finish(a, 'failed', 'network down');
    expect(tasks.running).toHaveLength(0);
    expect(tasks.unseen).toHaveLength(2);
    tasks.markSeen();
    expect(tasks.unseen).toHaveLength(0);

    tasks.dismiss(a);
    expect(tasks.list.map((t) => t.id)).toEqual([b]);
    const c = tasks.start({ title: 'C', open: () => undefined });
    tasks.dismiss(c); // a running task cannot be dismissed
    expect(tasks.running).toHaveLength(1);
    tasks.finish(c, 'done', '');
    tasks.clearFinished();
    expect(tasks.list).toHaveLength(0);
  });
});
