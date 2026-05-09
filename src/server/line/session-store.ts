import type { Lang, IntentName } from './ai/types';

export type SessionStep = 'IDLE'|'CLASSIFYING'|'SLOT_FILLING'|'CONFIRMING'|'EXECUTING';

export type SessionState = {
  userId: string;
  role: 'resident' | 'housekeeper' | 'admin';
  step: SessionStep;
  intent?: IntentName;
  slots: Record<string, unknown>;
  missingSlots: string[];
  language: Lang;
  updatedAt: number;
  history?: string[];
  demoScriptId?: string;
  demoStep?: number;
};

/**
 * Storage backend for SessionStore. The default is an in-memory Map (suitable
 * for unit tests and single-process dev), and production swaps in a SQLite
 * backend at server boot via `sessionStore.setBackend(...)`.
 */
export interface SessionBackend {
  get(userId: string): SessionState | undefined;
  set(userId: string, state: SessionState): void;
  delete(userId: string): boolean;
  evictOlderThan(cutoffMs: number): void;
  size(): number;
}

class MapBackend implements SessionBackend {
  private map = new Map<string, SessionState>();
  get(userId: string) { return this.map.get(userId); }
  set(userId: string, state: SessionState) { this.map.set(userId, state); }
  delete(userId: string) { return this.map.delete(userId); }
  evictOlderThan(cutoffMs: number) {
    for (const [k, v] of this.map.entries()) {
      if (v.updatedAt < cutoffMs) this.map.delete(k);
    }
  }
  size() { return this.map.size; }
}

/**
 * SQLite-backed session storage. Persists the JSON-encoded SessionState in
 * the `line_sessions` table (see migrations/sqlite/0010_line_sessions.sql).
 *
 * Why JSON-blob and not normalized columns:
 *   - SessionState is a frequently-changing shape with optional fields
 *     (intent/demoScriptId/etc). JSON keeps the migration story simple at
 *     low query cost for our read pattern (always by primary key).
 *   - The denormalized `updated_at` column gives the TTL eviction sweep a
 *     covered index without JSON parsing.
 */
export class SqliteSessionBackend implements SessionBackend {
  private getStmt: any;
  private setStmt: any;
  private deleteStmt: any;
  private evictStmt: any;
  private countStmt: any;

  constructor(db: any) {
    this.getStmt = db.prepare(
      `SELECT state FROM line_sessions WHERE user_id = ?`,
    );
    this.setStmt = db.prepare(
      `INSERT INTO line_sessions (user_id, state, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    );
    this.deleteStmt = db.prepare(
      `DELETE FROM line_sessions WHERE user_id = ?`,
    );
    this.evictStmt = db.prepare(
      `DELETE FROM line_sessions WHERE updated_at < ?`,
    );
    this.countStmt = db.prepare(
      `SELECT COUNT(*) AS n FROM line_sessions`,
    );
  }

  get(userId: string): SessionState | undefined {
    const row = this.getStmt.get(userId) as { state: string } | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.state) as SessionState;
    } catch (err) {
      // Corrupt row — drop it so the user doesn't get stuck. This shouldn't
      // happen unless someone hand-edited the DB, but better than throwing
      // mid-dispatch and 500-ing the webhook.
      console.error('[SqliteSessionBackend] corrupt session row, dropping', { userId, err });
      this.deleteStmt.run(userId);
      return undefined;
    }
  }

  set(userId: string, state: SessionState): void {
    this.setStmt.run(userId, JSON.stringify(state), state.updatedAt);
  }

  delete(userId: string): boolean {
    const result = this.deleteStmt.run(userId) as { changes?: number };
    return (result.changes ?? 0) > 0;
  }

  evictOlderThan(cutoffMs: number): void {
    this.evictStmt.run(cutoffMs);
  }

  size(): number {
    const row = this.countStmt.get() as { n: number };
    return row.n;
  }
}

export class SessionStore {
  private backend: SessionBackend;
  private ttlMs: number;
  private now: () => number;

  constructor(opts: { ttlMs?: number; now?: () => number; backend?: SessionBackend } = {}) {
    this.ttlMs = opts.ttlMs ?? 30 * 60 * 1000;
    this.now = opts.now ?? Date.now;
    this.backend = opts.backend ?? new MapBackend();
  }

  /** Swap the storage backend at runtime. Used at server boot to switch the
   *  module-level singleton from the default in-memory Map to a SQLite-backed
   *  store, without breaking any callers that imported the singleton. */
  setBackend(backend: SessionBackend): void {
    this.backend = backend;
  }

  get(userId: string): SessionState | undefined { return this.backend.get(userId); }

  set(userId: string, state: SessionState): void {
    this.backend.set(userId, { ...state, updatedAt: this.now() });
  }

  clear(userId: string): void { this.backend.delete(userId); }

  evictExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    this.backend.evictOlderThan(cutoff);
  }

  size(): number { return this.backend.size(); }
}

export const sessionStore = new SessionStore();

/** Test escape hatch – resets the singleton's backend to a fresh in-memory
 *  Map. Existing imports of `sessionStore` keep working without any reload. */
export function resetSessionStore(): void {
  sessionStore.setBackend(new MapBackend());
}
