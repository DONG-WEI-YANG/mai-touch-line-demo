export function taipeiToday(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
export function monthDays(month: string): (string | null)[] {
  const [year, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= count; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
