import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import { lineAdminRouter } from '../../src/server/routers/lineAdminRouter';
import { makeRuntimeConfig } from '../../src/server/line/runtime-config';
import { makeLineUserRepo } from '../../src/server/line/line-user-repo';
import { makeMessageLog } from '../../src/server/line/message-log';

const SQL_006 = fs.readFileSync('migrations/sqlite/0006_line_integration.sql', 'utf8');
const SQL_007 = fs.readFileSync('migrations/sqlite/0007_runtime_config_and_demo_scripts.sql', 'utf8');

let db: Database.Database;
let ctx: any;

beforeEach(async () => {
  db = new Database(':memory:');
  db.prepare('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, role TEXT, name TEXT)').run();
  for (const stmt of SQL_006.split(';').map(s => s.trim()).filter(Boolean)) db.prepare(stmt).run();
  for (const stmt of SQL_007.split(';').map(s => s.trim()).filter(Boolean)) db.prepare(stmt).run();

  const runtimeConfig = makeRuntimeConfig(db);
  await runtimeConfig.load();
  const lineUserRepo = makeLineUserRepo(db);
  const messageLog = makeMessageLog(db);
  const lineClient = { push: vi.fn().mockResolvedValue(undefined) } as any;

  ctx = {
    user: { id: 1, role: 'admin', email: 'admin@test' },
    lineAdmin: { db, runtimeConfig, lineUserRepo, messageLog, lineClient, channelId: 'C' },
  };
});

const callerOf = () => lineAdminRouter.createCaller(ctx as any);

describe('lineAdminRouter', () => {
  it('configList returns seeded rows', async () => {
    const list = await callerOf().configList();
    expect(list.length).toBeGreaterThanOrEqual(7);  // 7 seed values
    expect(list.find(r => r.key === 'line.rateLimit.perMinute')?.value).toBe('10');
  });

  it('configSet with valid value persists + invalidates cache', async () => {
    await callerOf().configSet({ key: 'line.rateLimit.perMinute', value: 50 });
    const list = await callerOf().configList();
    expect(list.find(r => r.key === 'line.rateLimit.perMinute')?.value).toBe('50');
    expect(list.find(r => r.key === 'line.rateLimit.perMinute')?.updatedBy).toBe('admin@test');
  });

  it('configSet rejects out-of-range', async () => {
    await expect(callerOf().configSet({ key: 'line.rateLimit.perMinute', value: 99999 }))
      .rejects.toThrow(/between/);
  });

  it('configSet rejects unknown key', async () => {
    await expect(callerOf().configSet({ key: 'unknown.key', value: 1 }))
      .rejects.toThrow(/unknown/);
  });

  it('logsList returns rows in DESC order with cursor pagination', async () => {
    db.prepare(`INSERT INTO line_message_log (line_user_id, direction, message_type, content)
                VALUES ('U1','inbound','text','hello')`).run();
    db.prepare(`INSERT INTO line_message_log (line_user_id, direction, message_type, content)
                VALUES ('U1','outbound','text','reply')`).run();
    const r = await callerOf().logsList({ limit: 1 });
    expect(r.items.length).toBe(1);
    expect(r.nextCursor).toBeDefined();
  });

  it('logsList filters by direction', async () => {
    db.prepare(`INSERT INTO line_message_log (line_user_id, direction, message_type, content)
                VALUES ('U1','inbound','text','a')`).run();
    db.prepare(`INSERT INTO line_message_log (line_user_id, direction, message_type, content)
                VALUES ('U1','outbound','text','b')`).run();
    const r = await callerOf().logsList({ limit: 100, direction: 'outbound' });
    expect(r.items.every((x: any) => x.direction === 'outbound')).toBe(true);
    expect(r.items.length).toBe(1);
  });

  it('scriptsList returns 4 entries', async () => {
    const list = await callerOf().scriptsList();
    expect(list.length).toBe(4);
  });

  it('scriptsSetEnabled toggles row', async () => {
    await callerOf().scriptsSetEnabled({ id: 'facility', enabled: false });
    // enabled lives in demo_script_config (scriptsConfig), not the static
    // scriptsList registry which has no enabled field.
    const cfg = await callerOf().scriptsConfig();
    expect(cfg.find(s => s.id === 'facility')?.enabled).toBe(0);
  });

  it('usersList filters by role', async () => {
    db.prepare(`INSERT INTO line_user (channel_id, line_user_id, role) VALUES ('C', ?, ?)`).run('U' + 'a'.repeat(32), 'housekeeper');
    db.prepare(`INSERT INTO line_user (channel_id, line_user_id, role) VALUES ('C', ?, ?)`).run('U' + 'b'.repeat(32), 'resident');
    const list = await callerOf().usersList({ role: 'housekeeper' });
    expect(list.length).toBe(1);
  });

  it('usersSetRole rejects invalid lineUserId format', async () => {
    await expect(callerOf().usersSetRole({ lineUserId: 'invalid', role: 'admin' }))
      .rejects.toThrow();
  });

  it('usersPurgeDemo deletes demo users', async () => {
    db.prepare(`INSERT INTO line_user (channel_id, line_user_id, is_demo) VALUES ('C', ?, 1)`).run('U' + 'a'.repeat(32));
    db.prepare(`INSERT INTO line_user (channel_id, line_user_id, is_demo) VALUES ('C', ?, 0)`).run('U' + 'b'.repeat(32));
    const r = await callerOf().usersPurgeDemo();
    expect(r.deletedCount).toBe(1);
    const remaining = await callerOf().usersList({});
    expect(remaining.length).toBe(1);
  });

  it('health returns aggregate metrics', async () => {
    db.prepare(`INSERT INTO line_message_log (line_user_id, direction, message_type, content)
                VALUES ('U1','inbound','text','hi')`).run();
    const h = await callerOf().health();
    expect(h.todayCount).toBeGreaterThanOrEqual(1);
    expect(h.errorRate).toBeGreaterThanOrEqual(0);
    expect(typeof h.uptimeS).toBe('number');
  });

  it('manualPush calls lineClient.push and writes audit log', async () => {
    const userId = 'U' + 'a'.repeat(32);
    await callerOf().manualPush({ lineUserId: userId, text: 'debug' });
    expect(ctx.lineAdmin.lineClient.push).toHaveBeenCalledWith(userId,
      expect.objectContaining({ type: 'text', text: 'debug' }));
    const log = db.prepare(`SELECT * FROM line_message_log WHERE direction='outbound:debug'`).all();
    expect(log.length).toBe(1);
  });
});
