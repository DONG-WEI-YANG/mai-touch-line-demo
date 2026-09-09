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


describe('menu interaction limits',()=>{
  it('allows normal menu bursts without consuming the text budget, but still bounds menu traffic',()=>{
    const rl=makeRateLimiter({getLimits:()=>({perMinute:2,perDay:4}),getInteractionLimits:()=>({perMinute:60,perDay:2000}),now:()=>0});
    for(let i=0;i<60;i++) expect(rl.check('U1','interaction')).toBe(true);
    expect(rl.check('U1','interaction')).toBe(false);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
  });
  it('coalesces warnings for one minute and reports the actual daily wait',()=>{
    let now=0;
    const rl=makeRateLimiter({getLimits:()=>({perMinute:10,perDay:1}),now:()=>now});
    expect(rl.check('U1')).toBe(true);
    expect(rl.check('U1')).toBe(false);
    expect(rl.shouldNotify('U1')).toBe(true);
    expect(rl.shouldNotify('U1')).toBe(false);
    expect(rl.retryAfterSeconds('U1')).toBe(86400);
    now=60000;
    expect(rl.shouldNotify('U1')).toBe(true);
    expect(rl.retryAfterSeconds('U1')).toBe(86340);
    rl.reset();
    expect(rl.shouldNotify('U1')).toBe(true);
  });
});
