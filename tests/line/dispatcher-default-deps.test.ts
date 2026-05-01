import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setDispatchDeps, getDispatchDeps, resetDispatchDeps } from '../../src/server/line/dispatcher';
import { SessionStore } from '../../src/server/line/session-store';

const mkDeps = () => ({
  lineClient: { reply: vi.fn(), push: vi.fn(), replyOrPush: vi.fn() } as any,
  ai: { classify: vi.fn() } as any,
  store: new SessionStore(),
  lineUserRepo: { upsert: vi.fn(), byLineId: vi.fn(), setRole: vi.fn(), setLanguage: vi.fn(), listByRole: vi.fn() } as any,
  messageLog: { write: vi.fn() } as any,
  channelId: 'C1',
  bookFn: vi.fn(),
  pushHousekeepers: vi.fn(),
  updateOrder: vi.fn(),
  runSideEffect: vi.fn(),
});

describe('setDispatchDeps / getDispatchDeps / resetDispatchDeps', () => {
  beforeEach(() => resetDispatchDeps());

  it('getDispatchDeps throws when not configured', () => {
    expect(() => getDispatchDeps()).toThrow('not configured');
  });

  it('getDispatchDeps returns deps after setDispatchDeps', () => {
    const deps = mkDeps();
    setDispatchDeps(deps);
    expect(getDispatchDeps()).toBe(deps);
  });

  it('resetDispatchDeps clears configured deps', () => {
    setDispatchDeps(mkDeps());
    resetDispatchDeps();
    expect(() => getDispatchDeps()).toThrow('not configured');
  });

  it('setDispatchDeps allows replacing deps', () => {
    const d1 = mkDeps();
    const d2 = mkDeps();
    setDispatchDeps(d1);
    setDispatchDeps(d2);
    expect(getDispatchDeps()).toBe(d2);
  });
});
