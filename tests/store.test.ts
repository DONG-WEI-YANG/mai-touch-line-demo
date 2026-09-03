import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE, generateId } from "@/lib/store";

describe("client defaults", () => {
  it("uses a neutral profile until authenticated data arrives", () => {
    expect(DEFAULT_PROFILE).toEqual({
      name: "Resident",
      unit: "Unassigned",
      tier: "Platinum",
    });
  });

  it("generates distinct string IDs", () => {
    const first = generateId();
    const second = generateId();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(5);
  });
});
