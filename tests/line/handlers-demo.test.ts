import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startDemo, continueDemo, stopDemo } from '../../src/server/line/handlers/demo';
import { SessionStore } from '../../src/server/line/session-store';

// Stub setTimeout to zero-delay so tests with delayMs don't time out
beforeEach(() => {
  vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const mkClient = () => ({
  reply: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  replyOrPush: vi.fn().mockResolvedValue(undefined),
});

const mkLineUser = () => ({ lineUserId: 'U1', language: 'zh-TW' as const });

describe('demo engine — startDemo', () => {
  let store: SessionStore;
  beforeEach(() => { store = new SessionStore({ ttlMs: 60_000 }); });

  it('runs bot_say steps until first wait_user', async () => {
    const client = mkClient();
    const runSideEffect = vi.fn();
    await startDemo('facility', {
      store, client: client as any,
      lineUser: mkLineUser() as any,
      runSideEffect,
    });
    // facility script: 3 bot_say steps before first wait_user (step index 3)
    expect(client.push.mock.calls.length).toBeGreaterThanOrEqual(1);
    const s = store.get('U1');
    expect(s?.demoScriptId).toBe('facility');
    expect(s?.demoStep).toBeGreaterThan(0);
  });

  it('returns early for unknown script id with friendly message', async () => {
    const client = mkClient();
    await startDemo('nonexistent', {
      store, client: client as any,
      lineUser: mkLineUser() as any,
      runSideEffect: vi.fn(),
    });
    expect(client.push).toHaveBeenCalledWith('U1',
      expect.objectContaining({ type:'text', text: expect.stringMatching(/unknown/i) }));
    expect(store.get('U1')?.demoScriptId).toBeUndefined();
  });
});

describe('demo engine — continueDemo', () => {
  let store: SessionStore;
  beforeEach(() => { store = new SessionStore({ ttlMs: 60_000 }); });

  it('advances past wait_user when correct postback received', async () => {
    const client = mkClient();
    const runSideEffect = vi.fn();
    await startDemo('facility', { store, client: client as any,
      lineUser: mkLineUser() as any, runSideEffect });
    const before = store.get('U1')?.demoStep ?? 0;
    await continueDemo({
      type: 'postback', source: { userId: 'U1' },
      postback: { data: 'act=book&fac=gym' },
    } as any, { store, client: client as any,
      lineUser: mkLineUser() as any, runSideEffect });
    const after = store.get('U1')?.demoStep ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it('does NOT advance when expected postbackData mismatches', async () => {
    const client = mkClient();
    await startDemo('facility', { store, client: client as any,
      lineUser: mkLineUser() as any, runSideEffect: vi.fn() });
    const before = store.get('U1')?.demoStep ?? 0;
    await continueDemo({
      type: 'postback', source: { userId: 'U1' },
      postback: { data: 'act=foo' },
    } as any, { store, client: client as any,
      lineUser: mkLineUser() as any, runSideEffect: vi.fn() });
    expect(store.get('U1')?.demoStep).toBe(before);
  });

  it('runs side_effect via runSideEffect callback', async () => {
    const client = mkClient();
    const runSideEffect = vi.fn().mockResolvedValue(undefined);
    // Use the repair script — it has a side_effect very early
    await startDemo('repair', { store, client: client as any,
      lineUser: mkLineUser() as any, runSideEffect });
    // repair script: 3 bot_say + 1 side_effect at step 3 — should be triggered before any wait_user
    expect(runSideEffect).toHaveBeenCalled();
    expect(runSideEffect).toHaveBeenCalledWith(expect.objectContaining({
      router: 'workOrders', procedure: 'create',
    }));
  });

  it('clears demo state when script reaches end', async () => {
    const client = mkClient();
    // Use repair script — it has no wait_user so it runs end-to-end on startDemo
    await startDemo('repair', { store, client: client as any,
      lineUser: mkLineUser() as any, runSideEffect: vi.fn().mockResolvedValue(undefined) });
    const s = store.get('U1');
    expect(s?.demoScriptId).toBeUndefined();
    expect(s?.demoStep).toBeUndefined();
  });
});

describe('demo engine — stopDemo', () => {
  it('clears demo state and replies stopped message', async () => {
    const store = new SessionStore({ ttlMs: 60_000 });
    const client = mkClient();
    // Set up an active demo state
    store.set('U1', { userId:'U1', role:'resident', step:'IDLE', slots:{},
      missingSlots:[], language:'zh-TW', updatedAt: Date.now(),
      demoScriptId: 'facility', demoStep: 3 });
    await stopDemo({ store, client: client as any,
      lineUser: mkLineUser() as any, runSideEffect: vi.fn() });
    expect(store.get('U1')?.demoScriptId).toBeUndefined();
    expect(client.push).toHaveBeenCalled();
  });
});
