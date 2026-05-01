import { describe, it, expect } from "vitest";

describe("finance router", () => {
  it("should be importable", async () => {
    const mod = await import("../../../src/server/routers/finance");
    expect(mod.financeRouter).toBeDefined();
  });
});
