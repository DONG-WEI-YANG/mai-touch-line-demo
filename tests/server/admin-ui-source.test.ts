import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("legacy server admin UI", () => {
  it("renders real booking and work-order data without placeholder claims", () => {
    const source = readFileSync(resolve(__dirname, "../../src/server/admin.ts"), "utf8");
    expect(source).toContain("getBookingsWithDetails");
    expect(source).toContain("getWorkOrdersWithDetails");
    expect(source).not.toContain("預約管理 UI 開發中");
    expect(source).not.toContain("工作訂單管理 UI 開發中");
    expect(source).not.toContain("placeholder UI");
  });
});
