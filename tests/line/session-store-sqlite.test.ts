import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import {
  SessionStore,
  SqliteSessionBackend,
  type SessionState,
} from '../../src/server/line/session-store';

const SQL_010 = fs.readFileSync('migrations/sqlite/0010_line_sessions.sql', 'utf8');

let db: Database.Database;
let backend: SqliteSessionBackend;

beforeEach(() => {
  db = new Database(':memory:');
  for (const stmt of SQL_010.split(';').map(s => s.trim()).filter(Boolean)) {
    db.prepare(stmt).run();
  }
  backend = new SqliteSessionBackend(db);
});

const baseState = (overrides: Partial<SessionState> = {}): SessionState => ({
  userId: 'U1',
  role: 'resident',
  step: 'IDLE',
  slots: {},
  missingSlots: [],
  language: 'zh-TW',
  updatedAt: 0,
  ...overrides,
});

describe('SqliteSessionBackend', () => {
  it('stores and retrieves a session', () => {
    backend.set('U1', baseState({ updatedAt: 100 }));
    const got = backend.get('U1');
    expect(got?.step).toBe('IDLE');
    expect(got?.userId).toBe('U1');
  });

  it('round-trips complex slot/history payloads via JSON encoding', () => {
    backend.set('U2', baseState({
      userId: 'U2',
      step: 'SLOT_FILLING',
      slots: { facility: 'gym', date: '2026-05-10', guests: 3 },
      missingSlots: ['time'],
      history: ['hi', 'I want to book the gym'],
      intent: 'amenity_booking',
      updatedAt: 200,
    }));

    const got = backend.get('U2');
    expect(got?.slots).toEqual({ facility: 'gym', date: '2026-05-10', guests: 3 });
    expect(got?.missingSlots).toEqual(['time']);
    expect(got?.history).toEqual(['hi', 'I want to book the gym']);
    expect(got?.intent).toBe('amenity_booking');
  });

  it('UPSERT — set on the same userId overwrites the existing row', () => {
    backend.set('U3', baseState({ userId: 'U3', step: 'IDLE', updatedAt: 1 }));
    backend.set('U3', baseState({ userId: 'U3', step: 'CONFIRMING', updatedAt: 2 }));
    const got = backend.get('U3');
    expect(got?.step).toBe('CONFIRMING');
    expect(backend.size()).toBe(1);
  });

  it('delete returns true when a row existed and false otherwise', () => {
    backend.set('U4', baseState({ userId: 'U4', updatedAt: 1 }));
    expect(backend.delete('U4')).toBe(true);
    expect(backend.delete('U4')).toBe(false);
    expect(backend.get('U4')).toBeUndefined();
  });

  it('evictOlderThan removes only rows below the cutoff', () => {
    backend.set('old', baseState({ userId: 'old', updatedAt: 100 }));
    backend.set('mid', baseState({ userId: 'mid', updatedAt: 500 }));
    backend.set('new', baseState({ userId: 'new', updatedAt: 1000 }));

    backend.evictOlderThan(500);

    expect(backend.get('old')).toBeUndefined();
    // 500 is not < 500, so it survives — boundary check
    expect(backend.get('mid')).toBeDefined();
    expect(backend.get('new')).toBeDefined();
  });

  it('survives a process restart — fresh backend on the same DB sees prior state', () => {
    backend.set('persist', baseState({ userId: 'persist', step: 'CONFIRMING', updatedAt: 5 }));

    // Simulate a process restart: new backend instance, same SQLite handle.
    const reborn = new SqliteSessionBackend(db);
    expect(reborn.get('persist')?.step).toBe('CONFIRMING');
  });

  it('drops corrupt rows instead of throwing on get', () => {
    db.prepare(`INSERT INTO line_sessions (user_id, state, updated_at) VALUES (?, ?, ?)`)
      .run('corrupt', '{ this is not valid json', 1);
    expect(backend.get('corrupt')).toBeUndefined();
    // The corrupt row should be auto-cleaned
    expect(db.prepare(`SELECT 1 FROM line_sessions WHERE user_id = 'corrupt'`).get()).toBeUndefined();
  });
});

describe('SessionStore with SqliteSessionBackend', () => {
  it('integrates: setBackend swaps storage without breaking the API', () => {
    const store = new SessionStore({ ttlMs: 1000 });
    // Default Map behaviour
    store.set('U1', baseState({ userId: 'U1' }));
    expect(store.get('U1')?.step).toBe('IDLE');

    // Swap backends — old in-memory data stays behind, new persistent backend is empty
    store.setBackend(backend);
    expect(store.get('U1')).toBeUndefined();

    store.set('U1', baseState({ userId: 'U1', step: 'CONFIRMING' }));
    expect(store.get('U1')?.step).toBe('CONFIRMING');
  });

  it('evictExpired honours TTL via the backend', () => {
    let now = 10_000;
    const store = new SessionStore({ ttlMs: 1000, now: () => now, backend });
    store.set('old', baseState({ userId: 'old' }));  // updatedAt becomes now()
    now = 12_000;
    store.evictExpired();
    expect(store.get('old')).toBeUndefined();
  });
});
