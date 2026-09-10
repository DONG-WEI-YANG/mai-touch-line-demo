import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ raw: null as any, create: vi.fn(), logs: vi.fn() }));
vi.mock('../../src/server/database/adapter', () => ({ dbManager: {
  connect: async () => ({ db: { delete: () => ({ where: () => state.raw.prepare('DELETE FROM work_orders WHERE id=1').run() }) } }),
  getType: () => 'sqlite', getRawSqlite: () => state.raw,
} }));
import { deleteWorkOrder } from '../../src/server/db';
afterEach(() => state.raw?.close());
describe('linked history deletion', () => {
  it.each(['WO-1', 'V-1'])('preserves linked %s and its edges', async ref => {
    state.raw = new Database(':memory:');
    state.raw.exec('CREATE TABLE work_orders(id INTEGER PRIMARY KEY); INSERT INTO work_orders VALUES(1); CREATE TABLE line_record_links(source_ref TEXT,target_ref TEXT);');
    state.raw.prepare('INSERT INTO line_record_links VALUES(?,?)').run('BK-2', ref);
    await expect(deleteWorkOrder(1)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(state.raw.prepare('SELECT * FROM work_orders').all()).toHaveLength(1);
    expect(state.raw.prepare('SELECT * FROM line_record_links').all()).toHaveLength(1);
  });
  it('allows an unlinked order to be deleted', async () => {
    state.raw = new Database(':memory:');
    state.raw.exec('CREATE TABLE work_orders(id INTEGER PRIMARY KEY); INSERT INTO work_orders VALUES(1); CREATE TABLE line_record_links(source_ref TEXT,target_ref TEXT);');
    await deleteWorkOrder(1);
    expect(state.raw.prepare('SELECT * FROM work_orders').all()).toHaveLength(0);
  });
});
