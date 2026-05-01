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

export class SessionStore {
  private map = new Map<string, SessionState>();
  private ttlMs: number;
  private now: () => number;

  constructor(opts: { ttlMs?: number; now?: () => number } = {}) {
    this.ttlMs = opts.ttlMs ?? 30 * 60 * 1000;
    this.now = opts.now ?? Date.now;
  }

  get(userId: string): SessionState | undefined { return this.map.get(userId); }
  set(userId: string, state: SessionState): void {
    this.map.set(userId, { ...state, updatedAt: this.now() });
  }
  clear(userId: string): void { this.map.delete(userId); }

  evictExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [k, v] of this.map.entries()) {
      if (v.updatedAt < cutoff) this.map.delete(k);
    }
  }

  size(): number { return this.map.size; }
}

export const sessionStore = new SessionStore();

/** Test escape hatch – resets the module-level singleton between test suites. */
export function resetSessionStore(): void {
  // Replace the singleton's internal map with a fresh one without breaking
  // any existing references to the exported `sessionStore` object.
  (sessionStore as unknown as { map: Map<string, SessionState> }).map =
    new Map<string, SessionState>();
}
