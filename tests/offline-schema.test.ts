import { describe, expect, it } from "vitest";

import { parseOfflineQueue } from "../src/lib/offline-schema";

const validCancel = {
  id: "op-1",
  type: "cancel_booking",
  data: { id: 9 },
  timestamp: 1_725_000_000_000,
  retryCount: 0,
  status: "pending",
};

describe("parseOfflineQueue", () => {
  it("preserves valid operations without quarantine findings", () => {
    expect(parseOfflineQueue(JSON.stringify([validCancel]))).toEqual({
      operations: [validCancel],
      quarantined: [],
    });
  });

  it("quarantines corrupt JSON without exposing the raw payload", () => {
    expect(parseOfflineQueue("{resident-secret")).toEqual({
      operations: [],
      quarantined: [{ index: -1, reason: "invalid_json" }],
    });
  });

  it("quarantines unknown types, invalid statuses, bad payloads, and duplicate ids", () => {
    const result = parseOfflineQueue(JSON.stringify([
      validCancel,
      { ...validCancel, id: "op-2", type: "delete_everything" },
      { ...validCancel, id: "op-3", status: "done" },
      { ...validCancel, id: "op-4", data: { id: -1 } },
      { ...validCancel, data: { id: 10 } },
    ]));

    expect(result.operations).toEqual([validCancel]);
    expect(result.quarantined).toEqual([
      { index: 1, id: "op-2", reason: "invalid_operation" },
      { index: 2, id: "op-3", reason: "invalid_operation" },
      { index: 3, id: "op-4", reason: "invalid_payload" },
      { index: 4, id: "op-1", reason: "duplicate_id" },
    ]);
  });

  it("validates every supported operation payload contract", () => {
    const operations = [
      { ...validCancel, id: "create-booking", type: "create_booking", data: { amenityId: 2, date: "2026-09-05", startTime: "09:00", endTime: "10:00", guestCount: 1 } },
      { ...validCancel, id: "update-booking", type: "update_booking", data: { id: 2, status: "confirmed" } },
      { ...validCancel, id: "cancel-booking" },
      { ...validCancel, id: "create-work", type: "create_work_order", data: { title: "Leak", category: "maintenance", priority: "high" } },
      { ...validCancel, id: "update-work", type: "update_work_order", data: { id: 3, status: "resolved" } },
      { ...validCancel, id: "chat", type: "send_message", data: { message: "Hello", language: "en" } },
    ];

    expect(parseOfflineQueue(JSON.stringify(operations))).toEqual({
      operations,
      quarantined: [],
    });
  });
});
