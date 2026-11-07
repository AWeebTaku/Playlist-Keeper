/** Collect saved playlists for an export file. */
import { buildExport, exportFileName, type ExportList } from '../core/backup';
import type { Repo } from './db';

export async function collectExport(repo: Repo, ids: string[], app: string): Promise<{ text: string; name: string; count: number }> {
  const all = new Map((await repo.playlists()).map((p) => [p.id, p]));
  const lists: ExportList[] = [];
  for (const id of ids) {
    const p = all.get(id);
    if (p) lists.push({ id, title: p.title, lastSync: p.lastSync, items: await repo.items(id) });
  }
  return { text: buildExport(lists, { app }), name: exportFileName(lists), count: lists.length };
}
