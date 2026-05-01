/**
 * Calendar utility functions for the booking calendar view.
 */

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Get the year and month from a YYYY-MM-DD string or Date.
 */
export function getYearMonth(date: Date): { year: number; month: number } {
  return { year: date.getFullYear(), month: date.getMonth() };
}

/**
 * Format a year/month into a display string like "February 2026".
 */
export function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Get the short weekday headers (Sun, Mon, ..., Sat).
 */
export function getWeekdayHeaders(): string[] {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

/**
 * Generate a 6-week (42-day) calendar grid for a given year/month.
 * Includes trailing days from the previous month and leading days from the next month.
 */
export function getCalendarGrid(year: number, month: number): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateString(today);

  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const grid: CalendarDay[] = [];

  // Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = toDateString(new Date(prevYear, prevMonth, day));
    grid.push({
      date: dateStr,
      dayOfMonth: day,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateString(new Date(year, month, d));
    grid.push({
      date: dateStr,
      dayOfMonth: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days to fill up to 42 cells (6 rows)
  const remaining = 42 - grid.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = toDateString(new Date(nextYear, nextMonth, d));
    grid.push({
      date: dateStr,
      dayOfMonth: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return grid;
}

/**
 * Navigate to the previous month.
 */
export function getPrevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 0) return { year: year - 1, month: 11 };
  return { year, month: month - 1 };
}

/**
 * Navigate to the next month.
 */
export function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 11) return { year: year + 1, month: 0 };
  return { year, month: month + 1 };
}

/**
 * Convert a Date to YYYY-MM-DD string.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date string.
 */
export function getTodayString(): string {
  return toDateString(new Date());
}
