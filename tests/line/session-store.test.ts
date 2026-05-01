import { describe, it, expect } from 'vitest';
import { SessionStore } from '../../src/server/line/session-store';

describe('SessionStore', () => {
  const base = { userId:'U1', role:'resident' as const, step:'IDLE' as const,
                 slots:{}, missingSlots:[], language:'zh-TW' as const, updatedAt: 0 };

  it('stores and retrieves a session', () => {
    const s = new SessionStore({ ttlMs: 1000 });
    s.set('U1', base);
    expect(s.get('U1')?.step).toBe('IDLE');
  });

  it('evicts after TTL', () => {
    let now = 0;
    const s = new SessionStore({ ttlMs: 1, now: () => now });
    s.set('U1', { ...base, updatedAt: now });
    now = 100;
    s.evictExpired();
    expect(s.get('U1')).toBeUndefined();
  });

  it('clear removes a session', () => {
    const s = new SessionStore({ ttlMs: 1000 });
    s.set('U1', base);
    s.clear('U1');
    expect(s.get('U1')).toBeUndefined();
  });
});
