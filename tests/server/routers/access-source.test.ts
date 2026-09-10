import { beforeEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
vi.mock('../../../src/server/db', () => ({ createAccessLog: vi.fn(), getLatestAccessLogs: vi.fn() }));
import * as db from '../../../src/server/db';
import { accessRouter } from '../../../src/server/routers/access';
beforeEach(() => vi.clearAllMocks());
it('binds demo reports to the caller and cannot accept a trusted source', async () => {
  const caller = accessRouter.createCaller({ user: { id: 42, role: 'resident' } } as any);
  await caller.logEntry({ entryPoint: 'Lobby', result: 'success', source: 'gateway', userId: 99 } as any);
  expect(db.createAccessLog).toHaveBeenCalledWith({ entryPoint: 'Lobby', result: 'success', source: 'demo', userId: 42 });
});
it('never presents legacy or demo reports as verified device events', async () => {
  vi.mocked(db.getLatestAccessLogs).mockResolvedValue([{ id: 1, result: 'success' }, { id: 2, source: 'demo', result: 'success' }] as any);
  const feed = await accessRouter.createCaller({ user: { id: 1, role: 'admin' } } as any).liveFeed();
  expect(feed).toEqual([expect.objectContaining({ source: 'unverified', trusted: false }), expect.objectContaining({ source: 'demo', trusted: false })]);
});
it('migrates existing reports as unverified and persists new demo provenance', () => {
  const sqlite = new Database(':memory:');
  try {
    sqlite.exec(fs.readFileSync('migrations/sqlite/0001_initial_schema.sql', 'utf8'));
    sqlite.exec("INSERT INTO access_logs(entryPoint,result) VALUES('Old lobby','success')");
    sqlite.exec(fs.readFileSync('migrations/sqlite/0020_access_log_source.sql', 'utf8'));
    sqlite.exec("INSERT INTO access_logs(userId,entryPoint,result,source) VALUES(42,'Lobby','success','demo')");
    expect(sqlite.prepare('SELECT source FROM access_logs ORDER BY id').all()).toEqual([{ source: 'unverified' }, { source: 'demo' }]);
  } finally { sqlite.close(); }
});
