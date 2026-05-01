type Bucket = { minuteStart: number; minuteCount: number; dayStart: number; dayCount: number };

export function makeRateLimiter(opts: { perMinute: number; perDay: number; now?: () => number }) {
  const buckets = new Map<string, Bucket>();
  const now = opts.now ?? Date.now;
  return {
    check(userId: string): boolean {
      const t = now();
      const b = buckets.get(userId) ?? { minuteStart: t, minuteCount: 0, dayStart: t, dayCount: 0 };
      if (t - b.minuteStart >= 60_000) { b.minuteStart = t; b.minuteCount = 0; }
      if (t - b.dayStart >= 86_400_000) { b.dayStart = t; b.dayCount = 0; }
      if (b.minuteCount >= opts.perMinute) { buckets.set(userId, b); return false; }
      if (b.dayCount >= opts.perDay) { buckets.set(userId, b); return false; }
      b.minuteCount++; b.dayCount++;
      buckets.set(userId, b);
      return true;
    },
    snapshot(userId: string): Bucket | undefined { return buckets.get(userId); },
    reset(): void { buckets.clear(); },
  };
}
