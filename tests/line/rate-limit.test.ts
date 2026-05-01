import { describe, it, expect } from 'vitest';
import { makeRateLimiter } from '../../src/server/line/rate-limit';

describe('makeRateLimiter', () => {
  it('allows up to perMinute', () => {
    let now = 0;
    const rl = makeRateLimiter({ getLimits: () => ({ perMinute: 3, perDay: 100 }), now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
  });
  it('refills after a minute', () => {
    let now = 0;
    const rl = makeRateLimiter({ getLimits: () => ({ perMinute: 1, perDay: 100 }), now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
    now = 61_000;
    expect(rl.check('U1')).toBe(true);
  });
  it('enforces daily cap independent of minute window', () => {
    let now = 0;
    const rl = makeRateLimiter({ getLimits: () => ({ perMinute: 1000, perDay: 2 }), now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
  });
  it('different users have independent buckets', () => {
    let now = 0;
    const rl = makeRateLimiter({ getLimits: () => ({ perMinute: 1, perDay: 10 }), now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U2')).toBe(true);  // different user, fresh budget
    expect(rl.check('U1')).toBe(false); // U1 already over
  });
  it('reads updated limits dynamically per check', () => {
    let now = 0;
    let perMinute = 2;
    const rl = makeRateLimiter({ getLimits: () => ({ perMinute, perDay: 100 }), now: () => now });
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false); // at limit=2
    perMinute = 3; // increase limit to 3
    now = 61_000;  // advance past minute window to reset bucket
    // After minute reset: 3 allowed, then blocked
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false); // now over new limit of 3
  });
});
