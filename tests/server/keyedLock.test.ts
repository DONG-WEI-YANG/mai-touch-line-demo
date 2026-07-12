import { describe, it, expect } from "vitest";
import { runExclusive } from "../../src/server/_core/keyedLock";

describe("runExclusive", () => {
  it("serializes tasks sharing a key (no interleave between check and write)", async () => {
    const events: string[] = [];
    // Two tasks on the same key; each yields in the middle. Without the lock they
    // would interleave (A-start, B-start, A-end, B-end). With it: A fully, then B.
    const task = (id: string) => runExclusive("slot-1", async () => {
      events.push(`${id}-start`);
      await new Promise((r) => setTimeout(r, 10));
      events.push(`${id}-end`);
    });
    await Promise.all([task("A"), task("B")]);
    // A completes entirely before B starts (order of A/B may vary, but no interleave)
    expect(events).toEqual([
      events[0], events[0].replace("start", "end"),
      events[2], events[2].replace("start", "end"),
    ]);
    expect(events[0].endsWith("-start")).toBe(true);
    expect(events[1]).toBe(events[0].replace("start", "end"));
  });

  it("runs different keys concurrently (does not serialize unrelated slots)", async () => {
    const order: string[] = [];
    const a = runExclusive("slot-A", async () => { order.push("a-start"); await new Promise(r => setTimeout(r, 20)); order.push("a-end"); });
    const b = runExclusive("slot-B", async () => { order.push("b-start"); await new Promise(r => setTimeout(r, 5)); order.push("b-end"); });
    await Promise.all([a, b]);
    // different keys overlap → b starts before a ends
    expect(order.indexOf("b-start")).toBeLessThan(order.indexOf("a-end"));
  });

  it("returns the task's value and releases the lock after a throw", async () => {
    await expect(runExclusive("k", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    // lock released → next task on same key still runs
    const v = await runExclusive("k", async () => 42);
    expect(v).toBe(42);
  });
});
