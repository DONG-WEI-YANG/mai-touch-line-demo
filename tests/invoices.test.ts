import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import { makeInvoicesRepo, type InvoicesRepo } from '../src/server/invoices-repo';
import {
  financeRouter,
  setInvoicesRepoForTests,
  resetInvoicesRepoForTests,
} from '../src/server/routers/finance';

const SQL_014 = fs.readFileSync('migrations/sqlite/0014_invoices.sql', 'utf8');

let db: Database.Database;
let repo: InvoicesRepo;

beforeEach(() => {
  db = new Database(':memory:');
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)`).run();
  db.prepare(`INSERT INTO users (id, name, role) VALUES (1, 'Alice', 'resident'), (2, 'Admin', 'admin')`).run();
  for (const stmt of SQL_014.split(';').map((s) => s.trim()).filter(Boolean)) {
    db.prepare(stmt).run();
  }
  repo = makeInvoicesRepo(db);
  resetInvoicesRepoForTests();
});

describe('InvoicesRepo', () => {
  it('issue + myAll round-trip with cents stored as integer', () => {
    repo.issue({
      userId: 1, description: '2026/05 管理費', amountCents: 350000,
      issuedBy: 2,
    });
    const all = repo.myAll(1);
    expect(all).toHaveLength(1);
    expect(all[0].amountCents).toBe(350000);
    expect(all[0].paidAt).toBeNull();
  });

  it('myUnpaid excludes paid invoices', () => {
    const id = repo.issue({ userId: 1, description: 'A', amountCents: 100, issuedBy: 2 });
    repo.issue({ userId: 1, description: 'B', amountCents: 200, issuedBy: 2 });
    repo.markPaid(id, 'cash');

    const unpaid = repo.myUnpaid(1);
    expect(unpaid).toHaveLength(1);
    expect(unpaid[0].description).toBe('B');
  });

  it('summaryFor sums only open invoices', () => {
    const a = repo.issue({ userId: 1, description: 'A', amountCents: 100, issuedBy: 2 });
    repo.issue({ userId: 1, description: 'B', amountCents: 200, issuedBy: 2 });
    repo.issue({ userId: 1, description: 'C', amountCents: 300, issuedBy: 2 });
    repo.markPaid(a, 'cash');

    const s = repo.summaryFor(1);
    expect(s.openCount).toBe(2);
    expect(s.openCents).toBe(500);
  });

  it('markPaid second call no-ops', () => {
    const id = repo.issue({ userId: 1, description: 'X', amountCents: 100, issuedBy: 2 });
    expect(repo.markPaid(id, 'cash')).toBe(true);
    expect(repo.markPaid(id, 'cash')).toBe(false);
  });

  it('cross-user isolation: A sees only their invoices', () => {
    db.prepare(`INSERT INTO users (id, name, role) VALUES (3, 'Bob', 'resident')`).run();
    repo.issue({ userId: 1, description: 'A', amountCents: 100, issuedBy: 2 });
    repo.issue({ userId: 3, description: 'B', amountCents: 200, issuedBy: 2 });
    expect(repo.myAll(1)).toHaveLength(1);
    expect(repo.myAll(3)).toHaveLength(1);
  });
});

describe('financeRouter invoices', () => {
  function callerFor(role: 'resident' | 'admin' | 'logistics', userId = 1) {
    setInvoicesRepoForTests(repo);
    return financeRouter.createCaller({
      user: { id: userId, role, openId: `u${userId}` },
      req: { protocol: 'https', headers: {} },
      res: { clearCookie: () => {} },
    } as any);
  }

  it('admin issues, resident sees', async () => {
    const admin = callerFor('admin', 2);
    await admin.issueInvoice({
      userId: 1, description: '管理費', amountCents: 350000,
    });
    const resident = callerFor('resident', 1);
    const my = await resident.myInvoices();
    expect(my).toHaveLength(1);
    expect(my[0].amountCents).toBe(350000);
  });

  it('resident cannot issueInvoice', async () => {
    const r = callerFor('resident', 1);
    await expect(r.issueInvoice({ userId: 1, description: 'x', amountCents: 1 })).rejects.toThrow();
  });

  it('admin markPaid + resident myUnpaid reflects update', async () => {
    const admin = callerFor('admin', 2);
    const r = await admin.issueInvoice({ userId: 1, description: 'x', amountCents: 100 });
    const before = await callerFor('resident', 1).myUnpaid();
    expect(before.summary.openCount).toBe(1);

    await admin.markInvoicePaid({ id: r.id, method: 'transfer' });
    const after = await callerFor('resident', 1).myUnpaid();
    expect(after.summary.openCount).toBe(0);
    expect(after.summary.openCents).toBe(0);
  });
});
