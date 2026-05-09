import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import { makePackagesRepo, type PackagesRepo } from '../src/server/packages-repo';
import {
  packagesRouter,
  setPackagesRepoForTests,
  resetPackagesRepoForTests,
} from '../src/server/routers/packages';

const SQL_012 = fs.readFileSync('migrations/sqlite/0012_packages.sql', 'utf8');

let db: Database.Database;
let repo: PackagesRepo;

beforeEach(() => {
  db = new Database(':memory:');
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)`).run();
  db.prepare(`INSERT INTO users (id, name, role) VALUES (1, 'Alice', 'resident'), (2, 'Front Desk', 'admin')`).run();
  for (const stmt of SQL_012.split(';').map((s) => s.trim()).filter(Boolean)) {
    db.prepare(stmt).run();
  }
  repo = makePackagesRepo(db);
  resetPackagesRepoForTests();
});

describe('PackagesRepo', () => {
  it('register mints a 4-digit PIN', () => {
    const r = repo.register({ recipientId: 1, courier: 'FedEx', registeredBy: 2 });
    expect(r.id).toBeGreaterThan(0);
    expect(r.pin).toMatch(/^\d{4}$/);
  });

  it('myPending returns only un-picked-up packages for that user', () => {
    const r1 = repo.register({ recipientId: 1, courier: 'A', registeredBy: 2 });
    repo.register({ recipientId: 1, courier: 'B', registeredBy: 2 });
    repo.markPickedUp(r1.id, 'Alice');

    const pending = repo.myPending(1);
    expect(pending).toHaveLength(1);
    expect(pending[0].courier).toBe('B');
    expect(pending[0].pickedUpAt).toBeNull();
  });

  it('myPending isolates between recipients', () => {
    db.prepare(`INSERT INTO users (id, name, role) VALUES (3, 'Bob', 'resident')`).run();
    repo.register({ recipientId: 1, courier: 'A', registeredBy: 2 });
    repo.register({ recipientId: 3, courier: 'B', registeredBy: 2 });
    expect(repo.myPending(1)).toHaveLength(1);
    expect(repo.myPending(3)).toHaveLength(1);
  });

  it('markPickedUp twice on the same id no-ops the second time', () => {
    const r = repo.register({ recipientId: 1, courier: 'A', registeredBy: 2 });
    expect(repo.markPickedUp(r.id, 'Alice')).toBe(true);
    // Second call: already-picked-up rows are filtered by the WHERE clause.
    expect(repo.markPickedUp(r.id, 'Alice')).toBe(false);
  });

  it('listAll sorts pending first', () => {
    const r1 = repo.register({ recipientId: 1, courier: 'A', registeredBy: 2 });
    repo.register({ recipientId: 1, courier: 'B', registeredBy: 2 });
    repo.markPickedUp(r1.id, 'Alice');
    const all = repo.listAll();
    // Pending B should come before completed A
    expect(all[0].pickedUpAt).toBeNull();
    expect(all[0].courier).toBe('B');
  });
});

describe('packagesRouter', () => {
  function callerFor(role: 'resident' | 'admin' | 'logistics', userId = 1) {
    setPackagesRepoForTests(repo);
    const ctx = {
      user: { id: userId, role, openId: `u${userId}` },
      req: { protocol: 'https', headers: {} },
      res: { clearCookie: () => {} },
    } as any;
    return packagesRouter.createCaller(ctx);
  }

  it('staff register + resident sees their own', async () => {
    const admin = callerFor('admin', 2);
    const r = await admin.register({ recipientId: 1, courier: 'FedEx' });
    expect(r.pin).toMatch(/^\d{4}$/);

    const resident = callerFor('resident', 1);
    const mine = await resident.myPending();
    expect(mine).toHaveLength(1);
    expect(mine[0].pickupPin).toBe(r.pin);
  });

  it('resident cannot register', async () => {
    const r = callerFor('resident', 1);
    await expect(r.register({ recipientId: 1, courier: 'X' })).rejects.toThrow();
  });

  it('staff markPickedUp closes the loop', async () => {
    const admin = callerFor('admin', 2);
    const r = await admin.register({ recipientId: 1 });
    await admin.markPickedUp({ id: r.id, pickedUpBy: 'Alice' });

    const after = repo.myPending(1);
    expect(after).toHaveLength(0);
  });
});
