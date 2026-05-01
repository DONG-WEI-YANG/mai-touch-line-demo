import type Database from 'better-sqlite3';

export type RuntimeConfigType = 'number' | 'string' | 'bool' | 'json';

export function makeRuntimeConfig(db: Database.Database) {
  let cache: Record<string, unknown> | null = null;

  const selectAll  = db.prepare(`SELECT key, value FROM runtime_config`);
  const selectType = db.prepare(`SELECT type FROM runtime_config WHERE key=?`);
  const upsert     = db.prepare(`
    INSERT INTO runtime_config (key, value, type, description, updated_by, updated_at)
    VALUES (?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value      = excluded.value,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `);

  return {
    async load(): Promise<void> {
      const rows = selectAll.all() as Array<{ key: string; value: string }>;
      cache = Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)]));
    },

    get<T>(key: string, fallback: T): T {
      if (!cache) throw new Error('runtime-config: load() must be called before get()');
      const v = cache[key];
      return (v ?? fallback) as T;
    },

    async set(key: string, value: unknown, updatedBy: string): Promise<void> {
      const existing = selectType.get(key) as { type: RuntimeConfigType } | undefined;
      const inferredType: RuntimeConfigType = existing?.type ??
        (typeof value === 'number'  ? 'number'  :
         typeof value === 'boolean' ? 'bool'    :
         typeof value === 'string'  ? 'string'  : 'json');
      upsert.run(key, JSON.stringify(value), inferredType, updatedBy);
      cache = null;
      await this.load();
    },

    invalidate(): void { cache = null; },

    snapshot(): Record<string, unknown> { return { ...(cache ?? {}) }; },
  };
}
