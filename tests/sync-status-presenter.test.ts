import { describe, expect, it } from "vitest";

import { getSyncStatusPresentation } from "../src/lib/sync-status";
import type { OfflineQueueSnapshot } from "../src/lib/offline";

function snapshot(patch: Partial<OfflineQueueSnapshot> = {}): OfflineQueueSnapshot {
  return {
    online: true,
    syncing: false,
    pendingCount: 0,
    failedCount: 0,
    totalCount: 0,
    lastSyncAt: null,
    ...patch,
  };
}

describe("getSyncStatusPresentation", () => {
  it("hides when online and the durable queue is empty", () => {
    expect(getSyncStatusPresentation(snapshot(), "en")).toEqual({
      visible: false,
      tone: "muted",
      title: "",
      detail: "",
      canRetry: false,
    });
  });

  it("shows offline even before an operation is queued", () => {
    expect(getSyncStatusPresentation(snapshot({ online: false }), "zh")).toMatchObject({
      visible: true,
      tone: "warning",
      title: "目前離線",
      canRetry: false,
    });
  });

  it("reports queued count without claiming delivery", () => {
    expect(getSyncStatusPresentation(snapshot({ pendingCount: 2, totalCount: 2 }), "en")).toMatchObject({
      visible: true,
      tone: "warning",
      title: "2 changes waiting",
      detail: "They are not confirmed yet.",
      canRetry: false,
    });
  });

  it("prioritizes syncing and failed states with an explicit retry action", () => {
    expect(getSyncStatusPresentation(snapshot({ syncing: true, pendingCount: 1, totalCount: 1 }), "zh")).toMatchObject({
      tone: "active",
      title: "正在同步",
    });
    expect(getSyncStatusPresentation(snapshot({ failedCount: 3, totalCount: 3 }), "en")).toMatchObject({
      tone: "error",
      title: "3 changes need attention",
      canRetry: true,
    });
  });
});
