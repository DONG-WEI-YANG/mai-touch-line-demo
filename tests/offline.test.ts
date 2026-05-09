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
  return { storage };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storageHarness.storage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
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
  beforeEach(() => {
    for (const k of Object.keys(storageHarness.storage)) delete storageHarness.storage[k];
    netHarness.listeners.length = 0;
    netHarness.set({ isConnected: true });
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
});
