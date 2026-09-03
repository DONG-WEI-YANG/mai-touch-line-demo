import { describe, expect, it } from "vitest";

import {
  toClientBookingsWithDiagnostics,
  toClientWorkOrdersWithDiagnostics,
} from "../src/lib/api-types";

const validBooking = {
  id: 1,
  userId: 7,
  amenityId: 2,
  date: "2026-09-20",
  startTime: "09:00",
  endTime: "10:00",
  guestCount: 2,
  notes: null,
  status: "confirmed",
  createdAt: "2026-09-03T02:00:00.000Z",
  updatedAt: "2026-09-03T02:00:00.000Z",
};

const validWorkOrder = {
  id: 10,
  userId: 7,
  title: "Repair tap",
  description: null,
  category: "maintenance",
  priority: "high",
  status: "open",
  assignedTo: null,
  resolvedAt: null,
  createdAt: "2026-09-03T01:00:00.000Z",
  updatedAt: "2026-09-03T03:00:00.000Z",
};

describe("API conversion diagnostics", () => {
  it("rejects malformed bookings and duplicate ids while preserving valid null fields", () => {
    const result = toClientBookingsWithDiagnostics([
      validBooking,
      { ...validBooking, id: 2, date: "2026-02-30" },
      { ...validBooking, id: 3, status: "approved" },
      { ...validBooking, id: 1, amenityId: 8 },
      null,
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "1", amenityId: "2", notes: undefined });
    expect(result.rejectedCount).toBe(4);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "INVALID_DATE",
      "INVALID_BOOKING",
      "DUPLICATE_ID",
      "INVALID_BOOKING",
    ]);
  });

  it("sorts valid bookings by use date and start time with stable ids", () => {
    const result = toClientBookingsWithDiagnostics([
      validBooking,
      { ...validBooking, id: 2, date: "2026-09-19", startTime: "12:00", endTime: "13:00" },
      { ...validBooking, id: 3, date: "2026-09-19", startTime: "08:00", endTime: "09:00" },
    ]);

    expect(result.items.map((item) => item.id)).toEqual(["3", "2", "1"]);
    expect(result.rejectedCount).toBe(0);
  });

  it("rejects unsafe work-order enums and timestamps, then sorts newest updates first", () => {
    const result = toClientWorkOrdersWithDiagnostics([
      validWorkOrder,
      { ...validWorkOrder, id: 11, title: "Older", updatedAt: "2026-09-03T02:00:00.000Z" },
      { ...validWorkOrder, id: 12, category: "magic" },
      { ...validWorkOrder, id: 13, updatedAt: "not-a-date" },
    ]);

    expect(result.items.map((item) => item.id)).toEqual(["10", "11"]);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "INVALID_WORK_ORDER",
      "INVALID_TIMESTAMP",
    ]);
  });

  it("distinguishes an empty payload from a rejected non-array payload", () => {
    expect(toClientBookingsWithDiagnostics([])).toMatchObject({ items: [], rejectedCount: 0, issues: [] });
    expect(toClientBookingsWithDiagnostics({ error: true })).toMatchObject({
      items: [],
      rejectedCount: 1,
      issues: [{ index: -1, code: "INVALID_COLLECTION" }],
    });
  });
});
