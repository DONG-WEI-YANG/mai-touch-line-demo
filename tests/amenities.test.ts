import { describe, expect, it } from "vitest";

import {
  formatDateDisplay,
  formatTimeRange,
  getDayLabel,
  getNext7Days,
} from "@/lib/amenities";

describe("amenity calendar helpers", () => {
  it("returns seven unique UTC calendar dates in chronological order", () => {
    const days = getNext7Days();
    expect(days).toHaveLength(7);
    expect(new Set(days).size).toBe(7);
    expect([...days].sort()).toEqual(days);
    expect(days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))).toBe(true);
  });

  it("labels today and tomorrow on the same UTC basis", () => {
    const [today, tomorrow] = getNext7Days();
    expect(getDayLabel(today)).toBe("Today");
    expect(getDayLabel(tomorrow)).toBe("Tomorrow");
  });

  it("formats date and time ranges for display", () => {
    expect(formatDateDisplay("2026-09-03")).toMatch(/September|2026/);
    expect(formatTimeRange("09:00", "10:00")).toBe("09:00 – 10:00");
  });
});
