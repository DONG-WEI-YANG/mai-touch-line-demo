import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeText, batchAnalyzeText } from "../src/server/_core/nlpClient";

const root = resolve(__dirname, "..");

describe("AI truth audit", () => {
  it("reports disabled NLP as unavailable instead of fabricating a successful intent", async () => {
    const result = await analyzeText({ text: "Please book the pool" });
    const batch = await batchAnalyzeText([{ text: "Please book the pool" }]);

    expect(result).toMatchObject({ success: false, model_id: "disabled" });
    expect(result.intent).toBeUndefined();
    expect(batch[0]).toMatchObject({ success: false, model_id: "disabled" });
    expect(batch[0].intent).toBeUndefined();
  });

  it("contains no canned AI response generator or public mock API key fallback", () => {
    const source = [
      readFileSync(resolve(root, "src/lib/store.ts"), "utf8"),
      readFileSync(resolve(root, "src/lib/app-context.tsx"), "utf8"),
      readFileSync(resolve(root, "src/app/wallet.tsx"), "utf8"),
    ].join("\n");

    expect(source).not.toContain("AI_RESPONSES");
    expect(source).not.toContain("getAIResponse");
    expect(source).not.toContain('|| "mock-key"');
    expect(source.toLowerCase()).not.toContain("mock transaction");
  });

  it("starts server-backed collections empty instead of showing fixture records", () => {
    const source = readFileSync(resolve(root, "src/lib/app-context.tsx"), "utf8");
    expect(source).not.toContain("SAMPLE_WORK_ORDERS");
    expect(source).not.toContain("SAMPLE_BOOKINGS");
    expect(source).toMatch(/workOrders:\s*\[\]/);
    expect(source).toMatch(/bookings:\s*\[\]/);
  });
});
