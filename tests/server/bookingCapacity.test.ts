import { describe, it, expect } from "vitest";
import { occupancyForWindow, assertWithinCapacity } from "../../src/server/_core/bookingCapacity";

const b = (startTime: string, endTime: string, guestCount: number) => ({ startTime, endTime, guestCount });

describe("occupancyForWindow", () => {
  it("counts bookings whose time range OVERLAPS the requested window, not just exact startTime (audit C)", () => {
    const existing = [b("11:00", "23:00", 12)]; // long booking spanning the day
    // A 12:00-13:00 request overlaps the 11:00-23:00 booking → must count its 12 guests
    expect(occupancyForWindow(existing, "12:00", "13:00")).toBe(12);
  });

  it("excludes non-overlapping bookings (touching edges don't overlap)", () => {
    const existing = [b("09:00", "10:00", 5)];
    expect(occupancyForWindow(existing, "10:00", "11:00")).toBe(0); // 10:00 start == prev end → no overlap
    expect(occupancyForWindow(existing, "08:00", "09:00")).toBe(0);
  });

  it("sums guestCount across all overlapping bookings", () => {
    const existing = [b("10:00", "12:00", 3), b("11:00", "13:00", 4), b("14:00", "15:00", 9)];
    expect(occupancyForWindow(existing, "11:30", "11:45")).toBe(7); // first two overlap, third doesn't
  });
});

describe("assertWithinCapacity", () => {
  it("throws when the requested guests would exceed capacity for an overlapping slot", () => {
    const existing = [b("11:00", "23:00", 12)];
    expect(() => assertWithinCapacity({ existing, startTime: "12:00", endTime: "13:00", guestCount: 1, capacity: 12 })).toThrow(/capacity/i);
  });

  it("passes when there is room", () => {
    const existing = [b("11:00", "12:00", 5)];
    expect(() => assertWithinCapacity({ existing, startTime: "11:00", endTime: "12:00", guestCount: 3, capacity: 12 })).not.toThrow();
  });

  it("rejects a window whose end is not after its start", () => {
    expect(() => assertWithinCapacity({ existing: [], startTime: "12:00", endTime: "12:00", guestCount: 1, capacity: 12 })).toThrow(/time/i);
    expect(() => assertWithinCapacity({ existing: [], startTime: "13:00", endTime: "12:00", guestCount: 1, capacity: 12 })).toThrow(/time/i);
  });
});
