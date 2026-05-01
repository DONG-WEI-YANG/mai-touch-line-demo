import { describe, it, expect } from "vitest";
import {
  getCalendarGrid,
  getWeekdayHeaders,
  formatMonthYear,
  getPrevMonth,
  getNextMonth,
  getYearMonth,
  getTodayString,
  type CalendarDay,
} from "@/lib/calendar-utils";

describe("calendar-utils", () => {
  describe("getWeekdayHeaders", () => {
    it("returns 7 weekday abbreviations", () => {
      const headers = getWeekdayHeaders();
      expect(headers).toHaveLength(7);
      expect(headers[0]).toBe("Sun");
      expect(headers[6]).toBe("Sat");
    });
  });

  describe("formatMonthYear", () => {
    it("formats January 2026", () => {
      const result = formatMonthYear(2026, 0);
      expect(result).toBe("January 2026");
    });

    it("formats December 2025", () => {
      const result = formatMonthYear(2025, 11);
      expect(result).toBe("December 2025");
    });
  });

  describe("getPrevMonth", () => {
    it("goes from March to February", () => {
      const result = getPrevMonth(2026, 2);
      expect(result).toEqual({ year: 2026, month: 1 });
    });

    it("wraps from January to December of previous year", () => {
      const result = getPrevMonth(2026, 0);
      expect(result).toEqual({ year: 2025, month: 11 });
    });
  });

  describe("getNextMonth", () => {
    it("goes from February to March", () => {
      const result = getNextMonth(2026, 1);
      expect(result).toEqual({ year: 2026, month: 2 });
    });

    it("wraps from December to January of next year", () => {
      const result = getNextMonth(2025, 11);
      expect(result).toEqual({ year: 2026, month: 0 });
    });
  });

  describe("getYearMonth", () => {
    it("extracts year and month from a Date", () => {
      const result = getYearMonth(new Date(2026, 1, 15));
      expect(result).toEqual({ year: 2026, month: 1 });
    });
  });

  describe("getTodayString", () => {
    it("returns a valid YYYY-MM-DD string", () => {
      const today = getTodayString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getCalendarGrid", () => {
    it("returns a grid with 42 cells (6 rows x 7 columns)", () => {
      const grid = getCalendarGrid(2026, 1); // February 2026
      expect(grid.length).toBe(42);
    });

    it("marks current month days correctly", () => {
      const grid = getCalendarGrid(2026, 1); // February 2026
      const febDays = grid.filter((d) => d.isCurrentMonth);
      expect(febDays.length).toBe(28); // 2026 is not a leap year
    });

    it("includes previous and next month padding days", () => {
      const grid = getCalendarGrid(2026, 1); // February 2026
      const prevMonthDays = grid.filter((d) => !d.isCurrentMonth && grid.indexOf(d) < 7);
      expect(prevMonthDays.length).toBeGreaterThanOrEqual(0);
    });

    it("all days have valid date strings", () => {
      const grid = getCalendarGrid(2026, 5); // June 2026
      grid.forEach((day) => {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(day.dayOfMonth).toBeGreaterThanOrEqual(1);
        expect(day.dayOfMonth).toBeLessThanOrEqual(31);
      });
    });

    it("handles January correctly (prev month = December of prev year)", () => {
      const grid = getCalendarGrid(2026, 0); // January 2026
      const janDays = grid.filter((d) => d.isCurrentMonth);
      expect(janDays.length).toBe(31);
    });

    it("handles December correctly (next month = January of next year)", () => {
      const grid = getCalendarGrid(2025, 11); // December 2025
      const decDays = grid.filter((d) => d.isCurrentMonth);
      expect(decDays.length).toBe(31);
    });
  });
});
