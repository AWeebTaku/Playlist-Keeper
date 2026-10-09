/** The only database surface the app needs. One adapter for Tauri's SQLite plugin, one for tests (node:sqlite). */
export interface Sql {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export async function openAppDatabase(): Promise<Sql> {
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  const db = await Database.load('sqlite:keeper.db'); // the Rust side runs the migrations on load
  return {
    async execute(sql, params = []) {
      await db.execute(sql, params);
    },
    select: <T>(sql: string, params: unknown[] = []) => db.select<T[]>(sql, params),
  };
}
