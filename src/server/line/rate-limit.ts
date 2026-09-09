type Bucket = { minuteStart: number; minuteCount: number; dayStart: number; dayCount: number };
type Kind = 'message' | 'interaction';
type Limits = { perMinute: number; perDay: number };

export function makeRateLimiter(opts: {
  getLimits: () => Limits;
  getInteractionLimits?: () => Limits;
  now?: () => number;
}) {
  const buckets = new Map<string, Bucket>();
  const notices = new Map<string, number>();
  const now = opts.now ?? Date.now;
  const limitsFor = (kind: Kind) => kind === 'interaction' && opts.getInteractionLimits
    ? opts.getInteractionLimits() : opts.getLimits();
  return {
    check(userId: string, kind: Kind = 'message'): boolean {
      const t = now();
      const { perMinute, perDay } = limitsFor(kind);
      const key = `${kind}:${userId}`;
      const b = buckets.get(key) ?? { minuteStart: t, minuteCount: 0, dayStart: t, dayCount: 0 };
      if (t - b.minuteStart >= 60_000) { b.minuteStart = t; b.minuteCount = 0; }
      if (t - b.dayStart >= 86_400_000) { b.dayStart = t; b.dayCount = 0; }
      buckets.set(key, b);
      if (b.minuteCount >= perMinute || b.dayCount >= perDay) return false;
      b.minuteCount++; b.dayCount++;
      return true;
    },
    shouldNotify(userId: string): boolean {
      const t = now();
      const last = notices.get(userId);
      if (last !== undefined && t - last < 60_000) return false;
      notices.set(userId, t);
      return true;
    },
    retryAfterSeconds(userId: string, kind: Kind = 'message'): number {
      const b = buckets.get(`${kind}:${userId}`);
      if (!b) return 0;
      const t = now();
      const { perMinute, perDay } = limitsFor(kind);
      return Math.ceil(Math.max(0,
        b.minuteCount >= perMinute ? b.minuteStart + 60_000 - t : 0,
        b.dayCount >= perDay ? b.dayStart + 86_400_000 - t : 0,
      ) / 1000);
    },
    snapshot(userId: string, kind: Kind = 'message'): Bucket | undefined { return buckets.get(`${kind}:${userId}`); },
    reset(): void { buckets.clear(); notices.clear(); },
  };
}
