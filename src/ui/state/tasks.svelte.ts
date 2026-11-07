/** Background tasks: things that keep running while the user looks at another screen, shown by the indicator in the top bar. */

export interface Task {
  id: number;
  title: string;
  state: 'running' | 'done' | 'failed';
  done: number;
  total: number;
  /** One line under the title: what is happening, or the outcome. */
  detail: string;
  /** Opened by the indicator: takes the user back to where the task lives. */
  open: () => void;
  /** The user has looked at the finished task. */
  seen: boolean;
}

class Tasks {
  list = $state<Task[]>([]);
  private next = 0;

  get running() {
    return this.list.filter((t) => t.state === 'running');
  }
  get unseen() {
    return this.list.filter((t) => t.state !== 'running' && !t.seen);
  }

  start(t: { title: string; open: () => void; total?: number; detail?: string }): number {
    const id = ++this.next;
    this.list.unshift({ id, title: t.title, state: 'running', done: 0, total: t.total ?? 0, detail: t.detail ?? 'Starting...', open: t.open, seen: false });
    return id;
  }

  patch(id: number, p: Partial<Pick<Task, 'title' | 'done' | 'total' | 'detail'>>) {
    const t = this.list.find((x) => x.id === id);
    if (t) Object.assign(t, p);
  }

  finish(id: number, state: 'done' | 'failed', detail: string) {
    const t = this.list.find((x) => x.id === id);
    if (t) Object.assign(t, { state, detail, done: state === 'done' ? t.total : t.done });
  }

  markSeen() {
    for (const t of this.list) if (t.state !== 'running') t.seen = true;
  }
  dismiss(id: number) {
    this.list = this.list.filter((t) => t.id !== id || t.state === 'running');
  }
  clearFinished() {
    this.list = this.list.filter((t) => t.state === 'running');
  }
}

export const tasks = new Tasks();
