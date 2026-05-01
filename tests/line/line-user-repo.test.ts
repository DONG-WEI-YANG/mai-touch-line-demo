import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { makeLineUserRepo } from '../../src/server/line/line-user-repo';

const SQL = fs.readFileSync(path.join(process.cwd(), 'migrations/sqlite/0006_line_integration.sql'), 'utf8');

let db: Database.Database;
let repo: ReturnType<typeof makeLineUserRepo>;

beforeEach(() => {
  db = new Database(':memory:');
  db.prepare('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, role TEXT)').run();
  // run migration 006 SQL via the better-sqlite3 multi-statement API
  for (const stmt of SQL.split(';').map(s => s.trim()).filter(Boolean)) db.prepare(stmt).run();
  repo = makeLineUserRepo(db);
});

describe('lineUserRepo', () => {
  it('upserts and reads back', () => {
    repo.upsert({ channelId:'C', lineUserId:'U1', displayName:'Bob' });
    const u = repo.byLineId('C', 'U1');
    expect(u?.displayName).toBe('Bob');
    expect(u?.role).toBe('resident');
  });
  it('updates role', () => {
    repo.upsert({ channelId:'C', lineUserId:'U1' });
    repo.setRole('C', 'U1', 'housekeeper');
    expect(repo.byLineId('C','U1')?.role).toBe('housekeeper');
  });
  it('updates language', () => {
    repo.upsert({ channelId:'C', lineUserId:'U1' });
    repo.setLanguage('C', 'U1', 'en');
    expect(repo.byLineId('C','U1')?.language).toBe('en');
  });
  it('lists by role', () => {
    repo.upsert({ channelId:'C', lineUserId:'U1', role:'housekeeper' });
    repo.upsert({ channelId:'C', lineUserId:'U2', role:'housekeeper' });
    repo.upsert({ channelId:'C', lineUserId:'U3', role:'resident' });
    expect(repo.listByRole('C','housekeeper').map(u=>u.lineUserId).sort()).toEqual(['U1','U2']);
  });
});
