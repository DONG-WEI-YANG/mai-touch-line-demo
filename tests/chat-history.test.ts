import { describe, expect, it } from "vitest";

import { normalizeChatHistory } from "../src/lib/chat-history";

describe("normalizeChatHistory", () => {
  it("returns unique messages in chronological order with confirmed user delivery", () => {
    const result = normalizeChatHistory([
      { id: 3, role: "assistant", content: "Third", createdAt: "2026-09-03T03:00:00.000Z" },
      { id: 2, role: "user", content: "Second", createdAt: new Date("2026-09-03T02:00:00.000Z") },
      { id: 2, role: "user", content: "Duplicate", createdAt: "2026-09-03T02:00:00.000Z" },
      { id: 1, role: "assistant", content: "First", createdAt: "2026-09-03T01:00:00.000Z" },
    ]);

    expect(result.map((message) => ({ id: message.id, content: message.content, delivery: message.delivery }))).toEqual([
      { id: "chat-1", content: "First", delivery: undefined },
      { id: "chat-2", content: "Second", delivery: "confirmed" },
      { id: "chat-3", content: "Third", delivery: undefined },
    ]);
  });

  it("drops malformed roles, blank content, invalid ids, and invalid timestamps", () => {
    const result = normalizeChatHistory([
      { id: 0, role: "user", content: "Bad id", createdAt: "2026-09-03T01:00:00Z" },
      { id: 1, role: "system", content: "Bad role", createdAt: "2026-09-03T01:00:00Z" },
      { id: 2, role: "assistant", content: "   ", createdAt: "2026-09-03T01:00:00Z" },
      { id: 3, role: "user", content: "Bad time", createdAt: "not-a-date" },
      null,
    ]);

    expect(result).toEqual([]);
  });

  it("returns an empty list for a non-array payload", () => {
    expect(normalizeChatHistory({ error: "not a list" })).toEqual([]);
  });
});
