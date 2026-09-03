import { describe, expect, it } from "vitest";

import {
  sendResidentChat,
  type ChatPersistenceInput,
  type ChatServiceDependencies,
} from "../../src/server/services/chatService";
import {
  LLMProviderError,
  type LLMOptions,
  type LLMResponse,
} from "../../src/server/_core/llm";

function providerResponse(text: string): LLMResponse {
  return {
    id: "chatcmpl-service-test",
    created: 1_725_000_001,
    model: "gpt-4o-mini",
    choices: [{
      index: 0,
      message: { role: "assistant", content: text },
      finish_reason: "stop",
    }],
  };
}

function createHarness(existing: ChatPersistenceInput[] = []) {
  const records = existing.map((record) => ({ ...record }));
  let capturedOptions: LLMOptions | undefined;
  const deps: ChatServiceDependencies = {
    async createMessage(input) {
      records.push({ ...input });
      return records.length;
    },
    async getMessages(userId, limit) {
      return records.filter((item) => item.userId === userId).slice(-limit).reverse();
    },
    async invoke(options) {
      capturedOptions = options;
      return providerResponse("I have checked that for you.");
    },
  };
  return { records, deps, getCapturedOptions: () => capturedOptions };
}

describe("sendResidentChat", () => {
  it("sends chronological resident history and persists one confirmed assistant reply", async () => {
    const harness = createHarness([
      { userId: 7, role: "user", content: "Earlier question", language: "en" },
      { userId: 7, role: "assistant", content: "Earlier answer", language: "en" },
      { userId: 99, role: "user", content: "Another resident", language: "en" },
    ]);

    const result = await sendResidentChat({
      userId: 7,
      message: "Please check the spa.",
      language: "en",
    }, harness.deps);

    expect(result).toEqual({ text: "I have checked that for you." });
    expect(harness.records.filter((item) => item.userId === 7)).toEqual([
      { userId: 7, role: "user", content: "Earlier question", language: "en" },
      { userId: 7, role: "assistant", content: "Earlier answer", language: "en" },
      { userId: 7, role: "user", content: "Please check the spa.", language: "en" },
      { userId: 7, role: "assistant", content: "I have checked that for you.", language: "en" },
    ]);
    expect(harness.getCapturedOptions()?.messages.slice(1).map((message) => message.content)).toEqual([
      [{ type: "text", text: "Earlier question" }],
      [{ type: "text", text: "Earlier answer" }],
      [{ type: "text", text: "Please check the spa." }],
    ]);
  });

  it("uses the Chinese system prompt and normalizes language tags", async () => {
    const harness = createHarness();

    await sendResidentChat({ userId: 1, message: "請幫我查詢", language: "zh-TW" }, harness.deps);

    const first = harness.getCapturedOptions()?.messages[0];
    expect(first?.role).toBe("system");
    expect(first?.content).toEqual([{ type: "text", text: expect.stringContaining("智慧管家") }]);
    expect(harness.records[0].language).toBe("zh");
  });

  it("keeps the user message but never persists a fake assistant reply on provider failure", async () => {
    const harness = createHarness();
    const providerError = new LLMProviderError("AI_UNAVAILABLE", "AI provider could not be reached", {
      retryable: true,
    });
    harness.deps.invoke = async () => { throw providerError; };

    await expect(sendResidentChat({
      userId: 3,
      message: "Book the lounge",
      language: "en",
    }, harness.deps)).rejects.toBe(providerError);

    expect(harness.records).toEqual([
      { userId: 3, role: "user", content: "Book the lounge", language: "en" },
    ]);
  });

  it("rejects whitespace before writing resident data", async () => {
    const harness = createHarness();

    await expect(sendResidentChat({
      userId: 3,
      message: "   ",
      language: "en",
    }, harness.deps)).rejects.toMatchObject({ code: "CHAT_MESSAGE_EMPTY" });
    expect(harness.records).toEqual([]);
  });
});
