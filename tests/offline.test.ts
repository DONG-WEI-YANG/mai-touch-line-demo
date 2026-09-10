import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.mock factories are hoisted above any `let`/`const` at module top, so
// shared state must live inside vi.hoisted() to be referenceable from within
// the factory body.
const netHarness = vi.hoisted(() => {
  const listeners: Array<(s: { isConnected: boolean }) => void> = [];
  let state: { isConnected: boolean } = { isConnected: true };
  return {
    listeners,
    fetchState: () => state,
    set: (next: { isConnected: boolean }) => {
      state = next;
    },
    emit: (next: { isConnected: boolean }) => {
      state = next;
      for (const l of listeners) l(next);
    },
  };
});

const storageHarness = vi.hoisted(() => {
  const storage: Record<string, string> = {};
  let setItemError: Error | null = null;
  return {
    storage,
    getSetItemError: () => setItemError,
    failSetItem: (error: Error | null) => { setItemError = error; },
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storageHarness.storage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      const failure = storageHarness.getSetItemError();
      if (failure) return Promise.reject(failure);
      storageHarness.storage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete storageHarness.storage[key];
      return Promise.resolve();
    }),
    getAllKeys: vi.fn(() => Promise.resolve(Object.keys(storageHarness.storage))),
    multiRemove: vi.fn((keys: string[]) => {
      for (const k of keys) delete storageHarness.storage[k];
      return Promise.resolve();
    }),
  },
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    configure: vi.fn(),
    fetch: vi.fn(() => Promise.resolve(netHarness.fetchState())),
    addEventListener: vi.fn((cb: (s: { isConnected: boolean }) => void) => {
      netHarness.listeners.push(cb);
      return () => {
        const i = netHarness.listeners.indexOf(cb);
        if (i >= 0) netHarness.listeners.splice(i, 1);
      };
    }),
  },
}));

import { OfflineService } from "@/lib/offline";
import AsyncStorage from '@react-native-async-storage/async-storage';

async function flush(times = 3) {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 0));
}

async function newReadyService(): Promise<OfflineService> {
  const svc = new OfflineService();
  // setupNetworkListener is async; let it register before tests poke listeners.
  await flush();
  return svc;
}

describe("OfflineService", () => {
  it('does not reveal an old cached response after switching accounts while storage is pending', async () => {
    const svc = await newReadyService();
    svc.setOwnerResolver(async () => 'A');
    await svc.refreshOwner();
    let finish!: (value: string) => void;
    vi.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = svc.loadData('bookings');
    await flush();
    svc.setOwnerResolver(async () => 'B');
    await svc.refreshOwner();
    finish(JSON.stringify([{ private: 'A booking' }]));
    expect(await pending).toBeNull();
  });
  it('ignores an older owner lookup that completes after an account switch', async () => {
    netHarness.set({ isConnected: false });
    const svc = await newReadyService();
    svc.setOwnerResolver(async () => 'A');
    await svc.refreshOwner();
    await svc.queueOperation({ type: 'send_message', data: { message: 'A private' } });
    let resolveOld!: (value: string) => void;
    svc.setOwnerResolver(() => new Promise(resolve => { resolveOld = resolve; }));
    svc.setOwnerResolver(async () => 'B');
    await svc.refreshOwner();
    resolveOld('A');
    await flush();
    expect(svc.getOperations()).toEqual([]);
    expect(svc.getSnapshot().totalCount).toBe(0);
  });
  it('keeps legacy unowned operations stored but never replays or exposes them to a new account', async () => {
    storageHarness.storage['@offline_sync_queue'] = JSON.stringify([{ id: 'legacy', type: 'send_message', data: { message: 'old private' }, timestamp: 1, retryCount: 0, status: 'pending' }]);
    const svc = await newReadyService();
    svc.setOwnerResolver(async () => 'B');
    await svc.refreshOwner();
    const handler = vi.fn();
    svc.setOperationHandler(handler);
    await svc.startSync();
    await svc.clearOperations();
    expect(handler).not.toHaveBeenCalled();
    expect(svc.getOperations()).toEqual([]);
    expect(JSON.parse(storageHarness.storage['@offline_sync_queue'])).toHaveLength(1);
  });
  it('does not replay another account or legacy unowned operations',async()=>{
    netHarness.set({isConnected:false});
    const svc=await newReadyService();
    let owner:string|null='A';
    svc.setOwnerResolver(async()=>owner);
    await svc.queueOperation({type:'send_message',data:{message:'private',language:'zh'}});
    owner='B';
    const handler=vi.fn().mockResolvedValue(undefined);
    svc.setOperationHandler(handler);
    netHarness.emit({isConnected:true});
    await flush();
    expect(handler).not.toHaveBeenCalled();
    owner='A';
    await svc.startSync();
    expect(handler).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    for (const k of Object.keys(storageHarness.storage)) delete storageHarness.storage[k];
    netHarness.listeners.length = 0;
    netHarness.set({ isConnected: true });
    storageHarness.failSetItem(null);
  });

  it("calls the registered handler for a queued operation when online", async () => {
    const svc = await newReadyService();
    const handler = vi.fn().mockResolvedValue(undefined);
    svc.setOperationHandler(handler);

    const id = await svc.queueOperation({
      type: "cancel_booking",
      data: { id: 99 },
    });
    await flush();

    expect(id).toMatch(/^op_/);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: "cancel_booking",
      data: { id: 99 },
    });
    expect(svc.getPendingCount()).toBe(0);
  });

  it("keeps op pending and does NOT mark complete when no handler is registered (no silent data loss)", async () => {
    const svc = await newReadyService();

    await svc.queueOperation({ type: "cancel_booking", data: { id: 1 } });
    await flush();

    const ops = svc.getOperations();
    expect(ops).toHaveLength(1);
    expect(ops[0].status).toBe("pending");
  });

  it("retries a failing op up to MAX_RETRIES then stops invoking the handler", async () => {
    const svc = await newReadyService();
    const handler = vi.fn().mockRejectedValue(new Error("server boom"));
    svc.setOperationHandler(handler);

    await svc.queueOperation({ type: "cancel_booking", data: { id: 2 } });
    await flush();

    // Drive additional sync cycles synchronously (production retries via
    // setTimeout — we skip the wall-clock wait by calling startSync directly).
    await svc.startSync();
    await svc.startSync();
    await svc.startSync();

    expect(handler.mock.calls.length).toBeLessThanOrEqual(3);
    const op = svc.getOperations()[0];
    expect(op.status).toBe("failed");
    expect(op.retryCount).toBeGreaterThanOrEqual(3);
    expect(op.error).toContain("server boom");
  });

  it("does not call handler while offline; drains queue when back online", async () => {
    netHarness.set({ isConnected: false }); // initial fetch returns offline
    const svc = await newReadyService();
    const handler = vi.fn().mockResolvedValue(undefined);
    svc.setOperationHandler(handler);

    await svc.queueOperation({ type: "cancel_booking", data: { id: 3 } });
    await flush();

    expect(handler).not.toHaveBeenCalled();
    expect(svc.getPendingCount()).toBe(1);

    // Reconnect — listener should trigger startSync
    netHarness.emit({ isConnected: true });
    await flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(svc.getPendingCount()).toBe(0);
  });

  it("persists queue to AsyncStorage so it survives a fresh service instance", async () => {
    const svc1 = await newReadyService();
    // No handler — op stays pending after sync attempt.
    await svc1.queueOperation({ type: "cancel_booking", data: { id: 7 } });
    await flush();
    expect(svc1.getPendingCount()).toBe(1);

    // New instance reads the persisted queue.
    const svc2 = await newReadyService();
    const ops = svc2.getOperations();
    expect(ops).toHaveLength(1);
    expect(ops[0].data).toEqual({ id: 7 });
  });

  it("quarantines invalid persisted entries and rewrites only the valid queue", async () => {
    storageHarness.storage['@offline_sync_queue'] = JSON.stringify([
      {
        id: 'valid-op', type: 'cancel_booking', data: { id: 7 },
        timestamp: Date.now(), retryCount: 0, status: 'pending',
      },
      {
        id: 'bad-op', type: 'cancel_booking', data: { id: -1 },
        timestamp: Date.now(), retryCount: 0, status: 'pending',
      },
    ]);

    const svc = await newReadyService();

    expect(svc.getOperations().map((op) => op.id)).toEqual(['valid-op']);
    expect(JSON.parse(storageHarness.storage['@offline_sync_queue'])).toHaveLength(1);
    expect(JSON.parse(storageHarness.storage['@offline_sync_quarantine'])).toMatchObject({
      count: 1,
      findings: [{ index: 1, id: 'bad-op', reason: 'invalid_payload' }],
    });
    expect(storageHarness.storage['@offline_sync_quarantine']).not.toContain('-1');
  });

  it("rolls back a newly queued operation when persistence fails", async () => {
    const svc = await newReadyService();
    let queuedEvents = 0;
    svc.on('operation:queued', () => { queuedEvents += 1; });
    storageHarness.failSetItem(new Error('storage full'));

    await expect(svc.queueOperation({ type: 'cancel_booking', data: { id: 8 } }))
      .rejects.toThrow('storage full');

    expect(svc.getOperations()).toEqual([]);
    expect(queuedEvents).toBe(0);
  });

  it("recovers an interrupted processing entry as pending after restart", async () => {
    storageHarness.storage['@offline_sync_queue'] = JSON.stringify([{
      id: 'interrupted', type: 'cancel_booking', data: { id: 9 },
      timestamp: Date.now(), retryCount: 1, status: 'processing',
    }]);

    const svc = await newReadyService();

    expect(svc.getOperations()[0]).toMatchObject({ id: 'interrupted', status: 'pending', retryCount: 1 });
    expect(JSON.parse(storageHarness.storage['@offline_sync_queue'])[0].status).toBe('pending');
  });

  it("emits completion only after the completed entry is removed from durable storage", async () => {
    netHarness.set({ isConnected: false });
    const svc = await newReadyService();
    svc.setOperationHandler(async () => undefined);
    await svc.queueOperation({ type: 'cancel_booking', data: { id: 10 } });
    let durableQueueAtCompletion: unknown = 'event-not-fired';
    svc.on('operation:completed', () => {
      durableQueueAtCompletion = JSON.parse(storageHarness.storage['@offline_sync_queue']);
    });

    netHarness.emit({ isConnected: true });
    await flush(6);

    expect(durableQueueAtCompletion).toEqual([]);
  });

  it("returns the same in-flight sync promise to concurrent callers", async () => {
    netHarness.set({ isConnected: false });
    const svc = await newReadyService();
    let release: (() => void) | undefined;
    svc.setOperationHandler(() => new Promise<void>((resolve) => { release = resolve; }));
    await svc.queueOperation({ type: 'cancel_booking', data: { id: 11 } });
    netHarness.emit({ isConnected: true });

    const first = svc.startSync();
    const second = svc.startSync();
    expect(second).toBe(first);
    await flush();
    expect(release).toBeTypeOf('function');
    release?.();
    await first;
  });

  it("retries one exhausted operation without clearing unrelated queue entries", async () => {
    netHarness.set({ isConnected: false });
    storageHarness.storage['@offline_sync_queue'] = JSON.stringify([
      { id: 'failed-1', type: 'cancel_booking', data: { id: 12 }, timestamp: Date.now(), retryCount: 3, status: 'failed', error: 'boom' },
      { id: 'pending-1', type: 'cancel_booking', data: { id: 13 }, timestamp: Date.now(), retryCount: 0, status: 'pending' },
    ]);
    const svc = await newReadyService();

    await expect(svc.retryOperation('failed-1')).resolves.toBe(true);

    expect(svc.getOperations()).toEqual([
      expect.objectContaining({ id: 'failed-1', status: 'pending', retryCount: 0, error: undefined }),
      expect.objectContaining({ id: 'pending-1', status: 'pending' }),
    ]);
    expect(await svc.retryOperation('missing')).toBe(false);
  });

  it("retries all failed entries and reports the exact count", async () => {
    netHarness.set({ isConnected: false });
    storageHarness.storage['@offline_sync_queue'] = JSON.stringify([
      { id: 'failed-1', type: 'cancel_booking', data: { id: 14 }, timestamp: Date.now(), retryCount: 3, status: 'failed' },
      { id: 'failed-2', type: 'cancel_booking', data: { id: 15 }, timestamp: Date.now(), retryCount: 2, status: 'failed' },
      { id: 'pending-1', type: 'cancel_booking', data: { id: 16 }, timestamp: Date.now(), retryCount: 0, status: 'pending' },
    ]);
    const svc = await newReadyService();

    expect(await svc.retryAllFailed()).toBe(2);
    expect(svc.getOperations().map((op) => [op.id, op.status, op.retryCount])).toEqual([
      ['failed-1', 'pending', 0],
      ['failed-2', 'pending', 0],
      ['pending-1', 'pending', 0],
    ]);
  });

  it("exposes an immutable queue snapshot and records the last successful sync", async () => {
    netHarness.set({ isConnected: false });
    const svc = await newReadyService();
    svc.setOperationHandler(async () => undefined);
    await svc.queueOperation({ type: 'cancel_booking', data: { id: 17 } });
    const before = svc.getSnapshot();
    expect(Object.isFrozen(before)).toBe(true);
    expect(before).toMatchObject({ online: false, syncing: false, pendingCount: 1, failedCount: 0, totalCount: 1, lastSyncAt: null });

    netHarness.emit({ isConnected: true });
    await flush(6);

    expect(svc.getSnapshot()).toMatchObject({ online: true, syncing: false, pendingCount: 0, failedCount: 0, totalCount: 0 });
    expect(svc.getSnapshot().lastSyncAt).toEqual(expect.any(Number));
  });

  it("returns an unsubscribe function that releases the status listener", async () => {
    const svc = await newReadyService();
    const before = svc.listenerCount('status:changed');

    const unsubscribe = svc.subscribe(() => undefined);
    expect(svc.listenerCount('status:changed')).toBe(before + 1);
    unsubscribe();

    expect(svc.listenerCount('status:changed')).toBe(before);
  });
});
