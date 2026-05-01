type Bucket = { minuteStart: number; minuteCount: number; dayStart: number; dayCount: number };

export function makeRateLimiter(opts: {
  getLimits: () => { perMinute: number; perDay: number };
  now?: () => number;
}) {
  const buckets = new Map<string, Bucket>();
  const now = opts.now ?? Date.now;
  return {
    check(userId: string): boolean {
      const t = now();
      const { perMinute, perDay } = opts.getLimits();
      const b = buckets.get(userId) ?? { minuteStart: t, minuteCount: 0, dayStart: t, dayCount: 0 };
      if (t - b.minuteStart >= 60_000) { b.minuteStart = t; b.minuteCount = 0; }
      if (t - b.dayStart >= 86_400_000) { b.dayStart = t; b.dayCount = 0; }
      if (b.minuteCount >= perMinute) { buckets.set(userId, b); return false; }
      if (b.dayCount >= perDay) { buckets.set(userId, b); return false; }
      b.minuteCount++; b.dayCount++;
      buckets.set(userId, b);
      return true;
    },
    snapshot(userId: string): Bucket | undefined { return buckets.get(userId); },
    reset(): void { buckets.clear(); },
  };
}
