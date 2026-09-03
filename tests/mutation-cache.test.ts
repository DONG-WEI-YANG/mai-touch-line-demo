import { describe, expect, it, vi } from "vitest";

import {
  MUTATION_CACHE_TARGETS,
  beginMutationCacheTransaction,
  invalidateConfirmedMutation,
  type MutationDomain,
  type MutationQueryKey,
} from "../src/lib/mutation-cache";

const expectedTargets: Record<MutationDomain, MutationQueryKey[]> = {
  booking: ["bookings.myBookings", "bookings.listAll", "amenities.getSlots"],
  workOrder: ["workOrders.myOrders", "workOrders.listAll"],
  package: ["packages.myPending", "packages.myAll", "packages.list"],
  parking: ["parking.spots", "parking.myAssignments", "parking.recent"],
  invoice: ["finance.invoicesList", "finance.myInvoices", "finance.myUnpaid"],
  announcement: ["announcements.listAll", "announcements.list"],
};

describe("confirmed mutation cache reconciliation", () => {
  it.each(Object.entries(expectedTargets) as Array<[MutationDomain, MutationQueryKey[]]>) (
    "refreshes every %s consumer without a full reload",
    async (domain, targets) => {
      const invalidated: string[] = [];
      const invalidators = Object.fromEntries(
        targets.map((target) => [target, vi.fn(async () => { invalidated.push(target); })]),
      );

      await invalidateConfirmedMutation(domain, invalidators);

      expect(invalidated).toEqual(targets);
      expect(MUTATION_CACHE_TARGETS[domain]).toEqual(targets);
    },
  );

  it("restores captured query values when an optimistic mutation fails", () => {
    const state = new Map<MutationQueryKey, unknown>([
      ["bookings.myBookings", [{ id: 1, status: "confirmed" }]],
      ["bookings.listAll", [{ booking: { id: 1, status: "confirmed" } }]],
      ["amenities.getSlots", [{ startTime: "09:00", available: true }]],
    ]);
    const transaction = beginMutationCacheTransaction("booking", {
      read: (key) => state.get(key),
      restore: (key, value) => state.set(key, value),
    });

    state.set("bookings.myBookings", [{ id: 1, status: "cancelled" }]);
    state.set("amenities.getSlots", [{ startTime: "09:00", available: false }]);
    transaction.rollback();

    expect(state.get("bookings.myBookings")).toEqual([{ id: 1, status: "confirmed" }]);
    expect(state.get("amenities.getSlots")).toEqual([{ startTime: "09:00", available: true }]);
  });

  it("invalidates only after a transaction is confirmed and cannot roll back afterward", async () => {
    const invalidate = vi.fn(async (_key: MutationQueryKey) => undefined);
    const transaction = beginMutationCacheTransaction("workOrder", {
      read: () => [],
      restore: vi.fn(),
      invalidate,
    });

    expect(invalidate).not.toHaveBeenCalled();
    await transaction.confirm();
    expect(invalidate.mock.calls.map(([key]) => key)).toEqual(expectedTargets.workOrder);
    expect(transaction.rollback()).toBe(false);
  });
});
