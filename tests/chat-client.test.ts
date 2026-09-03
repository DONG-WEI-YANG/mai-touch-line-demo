import { describe, expect, it } from "vitest";

import {
  deliverChatMessage,
  type ChatDeliveryDependencies,
  type QueuedChatInput,
} from "../src/lib/chat-client";

function harness(overrides: Partial<ChatDeliveryDependencies> = {}) {
  const sent: QueuedChatInput[] = [];
  const queued: QueuedChatInput[] = [];
  const deps: ChatDeliveryDependencies = {
    isOnline: () => true,
    async send(input) {
      sent.push(input);
      return { text: "A confirmed provider response" };
    },
    async enqueue(input) {
      queued.push(input);
      return "op-123";
    },
    ...overrides,
  };
  return { deps, sent, queued };
}

describe("deliverChatMessage", () => {
  it("returns only the real server response when online", async () => {
    const context = harness();

    const result = await deliverChatMessage({ message: "Hello", language: "en" }, context.deps);

    expect(result).toEqual({ status: "confirmed", text: "A confirmed provider response" });
    expect(context.sent).toEqual([{ message: "Hello", language: "en" }]);
    expect(context.queued).toEqual([]);
  });

  it("queues without calling the transport when the device is offline", async () => {
    const context = harness({ isOnline: () => false });

    const result = await deliverChatMessage({ message: "稍後送出", language: "zh" }, context.deps);

    expect(result).toEqual({ status: "queued", operationId: "op-123" });
    expect(context.sent).toEqual([]);
    expect(context.queued).toEqual([{ message: "稍後送出", language: "zh" }]);
  });

  it("queues a fetch-level network failure for later delivery", async () => {
    const context = harness({
      async send() { throw new TypeError("Failed to fetch"); },
    });

    const result = await deliverChatMessage({ message: "Try later", language: "en" }, context.deps);

    expect(result).toEqual({ status: "queued", operationId: "op-123" });
    expect(context.queued).toEqual([{ message: "Try later", language: "en" }]);
  });

  it("does not queue an application/provider error while connectivity is available", async () => {
    const providerError = Object.assign(new Error("AI provider unavailable"), {
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
    });
    const context = harness({
      async send() { throw providerError; },
    });

    await expect(deliverChatMessage({ message: "Hello", language: "en" }, context.deps))
      .rejects.toBe(providerError);
    expect(context.queued).toEqual([]);
  });

  it("rejects whitespace before transport or queue persistence", async () => {
    const context = harness();

    await expect(deliverChatMessage({ message: "  ", language: "en" }, context.deps))
      .rejects.toMatchObject({ code: "CHAT_MESSAGE_EMPTY" });
    expect(context.sent).toEqual([]);
    expect(context.queued).toEqual([]);
  });
});
