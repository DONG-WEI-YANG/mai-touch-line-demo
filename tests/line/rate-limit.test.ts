import { describe, it, expect } from 'vitest';
import { makeRateLimiter } from '../../src/server/line/rate-limit';

describe('makeRateLimiter', () => {
  it('allows up to perMinute', () => {
    let now = 0;
    const rl = makeRateLimiter({ perMinute: 3, perDay: 100, now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
  });
  it('refills after a minute', () => {
    let now = 0;
    const rl = makeRateLimiter({ perMinute: 1, perDay: 100, now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
    now = 61_000;
    expect(rl.check('U1')).toBe(true);
  });
  it('enforces daily cap independent of minute window', () => {
    let now = 0;
    const rl = makeRateLimiter({ perMinute: 1000, perDay: 2, now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
  });
  it('different users have independent buckets', () => {
    let now = 0;
    const rl = makeRateLimiter({ perMinute: 1, perDay: 10, now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U2')).toBe(true);  // different user, fresh budget
    expect(rl.check('U1')).toBe(false); // U1 already over
  });
});
