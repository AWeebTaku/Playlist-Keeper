import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Sql } from '../src/services/sql';

/** In-memory SQLite with the real migration applied, behind the same interface the app uses. */
export function memorySql(): Sql & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(new URL('../src-tauri/migrations/001_init.sql', import.meta.url), 'utf8'));
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
