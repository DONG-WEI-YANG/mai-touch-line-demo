import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import {
  makeAnnouncementsRepo,
  type AnnouncementsRepo,
} from '../src/server/announcements-repo';
import {
  announcementsRouter,
  setAnnouncementsRepoForTests,
  resetAnnouncementsRepoForTests,
} from '../src/server/routers/announcements';

const SQL_011 = fs.readFileSync('migrations/sqlite/0011_announcements.sql', 'utf8');

let db: Database.Database;
let repo: AnnouncementsRepo;

beforeEach(() => {
  db = new Database(':memory:');
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)`).run();
  // Seed one user so router's `create` (which records ctx.user.id=1 as posted_by)
  // doesn't trip the foreign-key check on `announcements.posted_by → users(id)`.
  db.prepare(`INSERT INTO users (id, name, role) VALUES (1, 'Test Admin', 'admin')`).run();
  for (const stmt of SQL_011.split(';').map((s) => s.trim()).filter(Boolean)) {
    db.prepare(stmt).run();
  }
  repo = makeAnnouncementsRepo(db);
  resetAnnouncementsRepoForTests();
});

describe('AnnouncementsRepo', () => {
  it('creates and lists for resident audience', () => {
    repo.create({ title: 'Pool closure', body: 'Pool closed Saturday', audience: 'all', postedBy: null });
    const rows = repo.list('resident');
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Pool closure');
    expect(rows[0].isPinned).toBe(false);
  });

  it('staff-only announcement is hidden from residents', () => {
    repo.create({ title: 'Staff meeting', body: 'Tuesday 9am', audience: 'staff', postedBy: null });
    expect(repo.list('resident')).toHaveLength(0);
    expect(repo.list('staff')).toHaveLength(1);
  });

  it('pinned items sort before non-pinned regardless of post time', () => {
    repo.create({ title: 'Old', body: 'b', audience: 'all', postedBy: null });
    // Manually backdate the first row so we can prove the sort isn't just by id.
    db.prepare(`UPDATE announcements SET posted_at = '2020-01-01 00:00:00' WHERE title = 'Old'`).run();
    const idPinned = repo.create({ title: 'Pinned', body: 'b', audience: 'all', isPinned: true, postedBy: null });
    repo.create({ title: 'Newest', body: 'b', audience: 'all', postedBy: null });

    const rows = repo.list('resident');
    expect(rows[0].id).toBe(idPinned);
    expect(rows[0].isPinned).toBe(true);
  });

  it('expired items are excluded', () => {
    const past = new Date(Date.now() - 60_000).toISOString().replace('T', ' ').slice(0, 19);
    repo.create({
      title: 'Expired notice', body: 'gone', audience: 'all', postedBy: null,
      expiresAt: past,
    });
    expect(repo.list('resident')).toHaveLength(0);
    // Admin listAll includes it so they can clean it up
    expect(repo.listAll()).toHaveLength(1);
  });

  it('update changes only specified fields', () => {
    const id = repo.create({ title: 'Old', body: 'orig', audience: 'all', postedBy: null });
    expect(repo.update({ id, title: 'New' })).toBe(true);
    const after = repo.list('resident');
    expect(after[0].title).toBe('New');
    expect(after[0].body).toBe('orig');
  });

  it('delete returns false for missing id', () => {
    expect(repo.delete(99999)).toBe(false);
  });
});

describe('announcementsRouter', () => {
  function callerFor(role: 'resident' | 'admin' | 'logistics') {
    setAnnouncementsRepoForTests(repo);
    const ctx = {
      user: { id: 1, role, openId: 'u1' },
      req: { protocol: 'https', headers: {} },
      res: { clearCookie: () => {} },
    } as any;
    return announcementsRouter.createCaller(ctx);
  }

  it('resident sees their audience filter', async () => {
    repo.create({ title: 'A', body: 'a', audience: 'resident', postedBy: null });
    repo.create({ title: 'B', body: 'b', audience: 'staff', postedBy: null });
    const list = await callerFor('resident').list();
    expect(list.map((r) => r.title)).toEqual(['A']);
  });

  it('admin listAll includes staff items', async () => {
    repo.create({ title: 'A', body: 'a', audience: 'staff', postedBy: null });
    const list = await callerFor('admin').listAll();
    expect(list).toHaveLength(1);
  });

  it('non-admin cannot create', async () => {
    const caller = callerFor('resident');
    await expect(
      caller.create({ title: 't', body: 'b', audience: 'all', isPinned: false }),
    ).rejects.toThrow();
  });

  it('admin create + delete flow', async () => {
    const caller = callerFor('admin');
    const r = await caller.create({ title: 't', body: 'b', audience: 'all', isPinned: false });
    expect(r.id).toBeGreaterThan(0);
    await caller.delete({ id: r.id });
    expect(repo.list('resident')).toHaveLength(0);
  });
});
