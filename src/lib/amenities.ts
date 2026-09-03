export function formatDateDisplay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getDayLabel(dateStr: string): string {
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export function getNext7Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + index);
    days.push(date.toISOString().split("T")[0]);
  }
  return days;
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} – ${end}`;
}
