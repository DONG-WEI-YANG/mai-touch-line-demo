import { describe, it, expect } from "vitest";
import {
  AMENITIES,
  SAMPLE_BOOKINGS,
  formatDateDisplay,
  getDayLabel,
  getNext7Days,
  formatTimeRange,
} from "@/lib/amenities";

describe("AMENITIES data", () => {
  it("should have 4 amenities", () => {
    expect(AMENITIES).toHaveLength(4);
  });

  it("each amenity should have required fields", () => {
    AMENITIES.forEach((a) => {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.icon).toBeTruthy();
      expect(a.location).toBeTruthy();
      expect(a.capacity).toBeGreaterThan(0);
      expect(a.rules.length).toBeGreaterThan(0);
      expect(a.availableSlots.length).toBeGreaterThan(0);
      expect(a.imageColor).toMatch(/^#/);
    });
  });

  it("should include Private Dining Room", () => {
    const dining = AMENITIES.find((a) => a.name === "Private Dining Room");
    expect(dining).toBeDefined();
    expect(dining!.capacity).toBe(12);
  });

  it("should include Sky Infinity Pool", () => {
    const pool = AMENITIES.find((a) => a.name === "Sky Infinity Pool");
    expect(pool).toBeDefined();
    expect(pool!.capacity).toBe(25);
  });

  it("each amenity should have time slots for 7 days", () => {
    AMENITIES.forEach((a) => {
      const uniqueDates = new Set(a.availableSlots.map((s) => s.date));
      expect(uniqueDates.size).toBe(7);
    });
  });

  it("time slots should have valid format", () => {
    const timeRegex = /^\d{2}:\d{2}$/;
    AMENITIES.forEach((a) => {
      a.availableSlots.forEach((slot) => {
        expect(slot.startTime).toMatch(timeRegex);
        expect(slot.endTime).toMatch(timeRegex);
        expect(typeof slot.available).toBe("boolean");
      });
    });
  });
});

describe("SAMPLE_BOOKINGS data", () => {
  it("should have 1 sample booking", () => {
    expect(SAMPLE_BOOKINGS).toHaveLength(1);
  });

  it("each booking should have required fields", () => {
    const validStatuses = ["confirmed", "upcoming", "completed", "cancelled"];
    SAMPLE_BOOKINGS.forEach((b) => {
      expect(b.id).toBeTruthy();
      expect(b.amenityId).toBeTruthy();
      expect(b.amenityName).toBeTruthy();
      expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(b.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(b.endTime).toMatch(/^\d{2}:\d{2}$/);
      expect(validStatuses).toContain(b.status);
      expect(b.createdAt).toBeGreaterThan(0);
    });
  });

  it("booking amenityIds should reference existing amenities", () => {
    const amenityIds = AMENITIES.map((a) => a.id);
    SAMPLE_BOOKINGS.forEach((b) => {
      expect(amenityIds).toContain(b.amenityId);
    });
  });
});

describe("formatDateDisplay", () => {
  it("should return formatted date", () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const result = formatDateDisplay(today);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getDayLabel", () => {
  it("should return 'Today' for today's date", () => {
    const today = new Date().toISOString().split("T")[0];
    const result = getDayLabel(today);
    expect(result).toBe("Today");
  });

  it("should return 'Tomorrow' for tomorrow's date", () => {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const tomorrowStr = now.toISOString().split("T")[0];
    const result = getDayLabel(tomorrowStr);
    expect(result).toBe("Tomorrow");
  });
});

describe("getNext7Days", () => {
  it("should return 7 dates", () => {
    const days = getNext7Days();
    expect(days).toHaveLength(7);
  });

  it("first date should be today", () => {
    const days = getNext7Days();
    const today = new Date().toISOString().split("T")[0];
    expect(days[0]).toBe(today);
  });

  it("dates should be in YYYY-MM-DD format", () => {
    const days = getNext7Days();
    days.forEach((d) => {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("dates should be consecutive", () => {
    const days = getNext7Days();
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1] + "T00:00:00");
      const curr = new Date(days[i] + "T00:00:00");
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(1);
    }
  });
});

describe("formatTimeRange", () => {
  it("should format time range correctly", () => {
    expect(formatTimeRange("09:00", "11:00")).toBe("09:00 – 11:00");
    expect(formatTimeRange("14:00", "16:00")).toBe("14:00 – 16:00");
  });
});
