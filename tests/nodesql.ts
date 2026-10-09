import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Sql } from '../src/services/sql';

/** In-memory SQLite with the real migrations applied (all of them, or only the first `upTo`), behind the same interface the app uses. */
export function memorySql(upTo = Infinity): Sql & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const dir = new URL('../src-tauri/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().slice(0, upTo)) raw.exec(readFileSync(new URL(f, dir), 'utf8'));
  const bind = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    raw,
    async execute(sql, params = []) {
      raw.prepare(sql).run(...bind(params));
    },
    async select<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...bind(params)) as T[];
    },
  };
}
