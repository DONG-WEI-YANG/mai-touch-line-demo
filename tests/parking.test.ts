import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import { makeParkingRepo, type ParkingRepo } from '../src/server/parking-repo';
import {
  parkingRouter,
  setParkingRepoForTests,
  resetParkingRepoForTests,
} from '../src/server/routers/parking';

const SQL_013 = fs.readFileSync('migrations/sqlite/0013_parking.sql', 'utf8');

let db: Database.Database;
let repo: ParkingRepo;

beforeEach(() => {
  db = new Database(':memory:');
  db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)`).run();
  db.prepare(`INSERT INTO users (id, name, role) VALUES (1, 'Alice', 'resident'), (2, 'Admin', 'admin')`).run();
  for (const stmt of SQL_013.split(';').map((s) => s.trim()).filter(Boolean)) {
    db.prepare(stmt).run();
  }
  repo = makeParkingRepo(db);
  resetParkingRepoForTests();
});

describe('ParkingRepo', () => {
  it('addSpot + spots() round-trip', () => {
    repo.addSpot({ label: 'B2-15', type: 'resident', zone: 'B2' });
    repo.addSpot({ label: 'GUEST-1', type: 'guest', zone: 'B1' });
    const spots = repo.spots();
    expect(spots).toHaveLength(2);
    expect(spots.find((s) => s.label === 'B2-15')?.type).toBe('resident');
    expect(spots.every((s) => s.activeAssignment === null)).toBe(true);
  });

  it('assign + spots() shows current occupant', () => {
    const spotId = repo.addSpot({ label: 'B2-15', type: 'resident' });
    repo.assign({
      spotId, userId: 1, vehiclePlate: 'abc-1234', purpose: 'resident_lease',
    });
    const spots = repo.spots();
    expect(spots[0].activeAssignment?.vehiclePlate).toBe('ABC-1234'); // upper-cased
    expect(spots[0].activeAssignment?.userName).toBe('Alice');
  });

  it('assign throws if spot occupied', () => {
    const spotId = repo.addSpot({ label: 'B2-15', type: 'resident' });
    repo.assign({ spotId, userId: 1, vehiclePlate: 'A1', purpose: 'resident_lease' });
    expect(() =>
      repo.assign({ spotId, userId: null, vehiclePlate: 'B2', purpose: 'visitor' }),
    ).toThrow(/occupied/);
  });

  it('release frees the spot for a new assignment', () => {
    const spotId = repo.addSpot({ label: 'X1', type: 'resident' });
    const a1 = repo.assign({ spotId, userId: 1, vehiclePlate: 'A1', purpose: 'resident_lease' });
    expect(repo.release(a1)).toBe(true);
    // Now a different vehicle should be able to take it
    const a2 = repo.assign({ spotId, userId: null, vehiclePlate: 'B2', purpose: 'visitor' });
    expect(a2).toBeGreaterThan(0);
  });

  it('requestVisitor finds the next free guest spot, returns null when none', () => {
    expect(repo.requestVisitor({ userId: 1, vehiclePlate: 'X1' })).toBeNull();

    repo.addSpot({ label: 'GUEST-1', type: 'guest' });
    const r = repo.requestVisitor({ userId: 1, vehiclePlate: 'visitor-1' });
    expect(r?.spotLabel).toBe('GUEST-1');
    expect(repo.requestVisitor({ userId: 1, vehiclePlate: 'visitor-2' })).toBeNull();
  });

  it('activeForUser filters by user and excludes released ones', () => {
    repo.addSpot({ label: 'A', type: 'resident' });
    repo.addSpot({ label: 'B', type: 'resident' });
    const a1 = repo.assign({ spotId: 1, userId: 1, vehiclePlate: 'P1', purpose: 'resident_lease' });
    repo.assign({ spotId: 2, userId: 1, vehiclePlate: 'P2', purpose: 'resident_lease' });
    repo.release(a1);

    const active = repo.activeForUser(1);
    expect(active).toHaveLength(1);
    expect(active[0].vehiclePlate).toBe('P2');
  });
});

describe('parkingRouter', () => {
  function callerFor(role: 'resident' | 'admin' | 'logistics', userId = 1) {
    setParkingRepoForTests(repo);
    return parkingRouter.createCaller({
      user: { id: userId, role, openId: `u${userId}` },
      req: { protocol: 'https', headers: {} },
      res: { clearCookie: () => {} },
    } as any);
  }

  it('resident requestVisitor success path', async () => {
    repo.addSpot({ label: 'GUEST-A', type: 'guest' });
    const r = await callerFor('resident', 1).requestVisitor({ vehiclePlate: 'XYZ-1' });
    expect(r.spotLabel).toBe('GUEST-A');
  });

  it('resident requestVisitor 失敗(無車位)→ PRECONDITION_FAILED', async () => {
    await expect(
      callerFor('resident', 1).requestVisitor({ vehiclePlate: 'XYZ-1' }),
    ).rejects.toThrow(/No guest parking/);
  });

  it('resident cannot release someone else’s assignment', async () => {
    db.prepare(`INSERT INTO users (id, name, role) VALUES (3, 'Bob', 'resident')`).run();
    repo.addSpot({ label: 'A', type: 'resident' });
    const id = repo.assign({ spotId: 1, userId: 3, vehiclePlate: 'P1', purpose: 'resident_lease' });
    await expect(callerFor('resident', 1).release({ assignmentId: id })).rejects.toThrow(/Not your/);
  });

  it('staff can release anyone', async () => {
    db.prepare(`INSERT INTO users (id, name, role) VALUES (3, 'Bob', 'resident')`).run();
    repo.addSpot({ label: 'A', type: 'resident' });
    const id = repo.assign({ spotId: 1, userId: 3, vehiclePlate: 'P1', purpose: 'resident_lease' });
    const r = await callerFor('admin', 2).release({ assignmentId: id });
    expect(r.success).toBe(true);
  });
});
