import { describe, expect, it } from "vitest";

import {
  getDeliveryPresentation,
  updateQueuedOperationDelivery,
  updateMessageDelivery,
} from "../src/lib/chat-messages";
import type { ChatMessage } from "../src/lib/types";

const baseMessages: ChatMessage[] = [
  { id: "assistant-1", role: "assistant", content: "Welcome", timestamp: 1 },
  { id: "user-1", role: "user", content: "Hello", timestamp: 2, delivery: "sending" },
];

describe("chat message delivery", () => {
  it("updates only the target while preserving the original collection", () => {
    const next = updateMessageDelivery(baseMessages, "user-1", {
      delivery: "queued",
      operationId: "op-9",
    });

    expect(next).not.toBe(baseMessages);
    expect(next[0]).toBe(baseMessages[0]);
    expect(next[1]).toEqual({
      ...baseMessages[1],
      delivery: "queued",
      operationId: "op-9",
      deliveryError: undefined,
    });
    expect(baseMessages[1].delivery).toBe("sending");
  });

  it("keeps confirmed delivery terminal when a stale failure arrives", () => {
    const confirmed: ChatMessage[] = [{
      id: "user-2",
      role: "user",
      content: "Done",
      timestamp: 3,
      delivery: "confirmed",
    }];

    const next = updateMessageDelivery(confirmed, "user-2", {
      delivery: "failed",
      deliveryError: "late error",
    });

    expect(next).toBe(confirmed);
  });

  it("maps every state to honest localized labels and retry availability", () => {
    expect(getDeliveryPresentation("sending", "en")).toEqual({ label: "Sending…", canRetry: false });
    expect(getDeliveryPresentation("queued", "zh")).toEqual({ label: "等待連線後送出", canRetry: false });
    expect(getDeliveryPresentation("confirmed", "en")).toEqual({ label: "Delivered", canRetry: false });
    expect(getDeliveryPresentation("failed", "zh")).toEqual({ label: "未送達", canRetry: true });
  });

  it("maps a durable queue event back to exactly one queued chat message", () => {
    const queued: ChatMessage[] = [
      { id: "user-1", role: "user", content: "A", timestamp: 1, delivery: "queued", operationId: "op-a" },
      { id: "user-2", role: "user", content: "B", timestamp: 2, delivery: "queued", operationId: "op-b" },
    ];

    const next = updateQueuedOperationDelivery(queued, "op-b", {
      delivery: "confirmed",
    });

    expect(next[0]).toBe(queued[0]);
    expect(next[1]).toMatchObject({ id: "user-2", delivery: "confirmed" });
    expect(next[1].operationId).toBeUndefined();
  });
});
