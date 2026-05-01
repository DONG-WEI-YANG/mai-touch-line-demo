import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import { makeRuntimeConfig } from '../../src/server/line/runtime-config';

const SQL = fs.readFileSync('migrations/sqlite/0007_runtime_config_and_demo_scripts.sql', 'utf8');

let db: Database.Database;
let cfg: ReturnType<typeof makeRuntimeConfig>;

beforeEach(() => {
  db = new Database(':memory:');
  for (const stmt of SQL.split(';').map(s => s.trim()).filter(Boolean)) db.prepare(stmt).run();
  cfg = makeRuntimeConfig(db);
});

describe('runtime-config', () => {
  it('reads seeded value', async () => {
    await cfg.load();
    expect(cfg.get<number>('line.rateLimit.perMinute', 999)).toBe(10);
    expect(cfg.get<string>('ai.openai.model', 'fallback')).toBe('gpt-4o-mini');
    expect(cfg.get<boolean>('demo.bannerEnabled', false)).toBe(true);
  });

  it('set updates DB and refreshes cache', async () => {
    await cfg.load();
    await cfg.set('line.rateLimit.perMinute', 50, 'admin@test');
    expect(cfg.get<number>('line.rateLimit.perMinute', 999)).toBe(50);
    // Verify persistence: re-read raw from db
    const row = db.prepare('SELECT value, updated_by FROM runtime_config WHERE key=?').get('line.rateLimit.perMinute') as any;
    expect(JSON.parse(row.value)).toBe(50);
    expect(row.updated_by).toBe('admin@test');
  });

  it('falls back when key missing', async () => {
    await cfg.load();
    expect(cfg.get<string>('nonexistent.key', 'default-val')).toBe('default-val');
  });

  it('snapshot returns shallow copy of cache', async () => {
    await cfg.load();
    const snap = cfg.snapshot();
    expect(snap['ai.openai.model']).toBe('gpt-4o-mini');
    snap['ai.openai.model'] = 'mutated';
    expect(cfg.get<string>('ai.openai.model', 'x')).toBe('gpt-4o-mini'); // not affected
  });

  it('throws if get called before load', () => {
    const fresh = makeRuntimeConfig(db);
    expect(() => fresh.get('any', 0)).toThrow(/load/i);
  });

  it('invalidate clears cache (next load re-reads)', async () => {
    await cfg.load();
    db.prepare('UPDATE runtime_config SET value=? WHERE key=?').run('999', 'line.rateLimit.perMinute');
    cfg.invalidate();
    expect(() => cfg.get('line.rateLimit.perMinute', 0)).toThrow(/load/i); // cleared
    await cfg.load();
    expect(cfg.get<number>('line.rateLimit.perMinute', 0)).toBe(999);
  });
});
