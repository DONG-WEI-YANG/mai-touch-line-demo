import { describe, expect, it } from "vitest";

import { formatCurrencyCents } from "../src/lib/currency";

describe("wallet currency formatting", () => {
  it("converts stored integer cents to major currency units", () => {
    expect(formatCurrencyCents(12_345)).toContain("123.45");
    expect(formatCurrencyCents(-5_000)).toContain("50.00");
  });

  it("never treats cents as whole dollars", () => {
    expect(formatCurrencyCents(12_345)).not.toContain("12,345");
  });
});
