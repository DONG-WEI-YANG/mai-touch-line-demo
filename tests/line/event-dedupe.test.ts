import { describe, it, expect } from 'vitest';
import { makeEventDedupe } from '../../src/server/line/event-dedupe';

describe('makeEventDedupe', () => {
  it('first occurrence is not seen, second is', () => {
    const d = makeEventDedupe(3);
    expect(d.seen('e1')).toBe(false);
    expect(d.seen('e1')).toBe(true);
  });
  it('LRU evicts oldest at capacity', () => {
    const d = makeEventDedupe(2);
    d.seen('e1'); d.seen('e2'); d.seen('e3');
    // After 3 inserts with cap=2: e1 is evicted (oldest). Window holds {e2, e3}.
    // Query e3 FIRST (before e1/e2 re-insertions cause further evictions).
    expect(d.seen('e3')).toBe(true);  // still in window
    expect(d.seen('e1')).toBe(false); // evicted, treated as fresh
    expect(d.seen('e2')).toBe(false); // also evicted
  });
  it('handles capacity 0 gracefully (always treats as fresh)', () => {
    const d = makeEventDedupe(0);
    expect(d.seen('e1')).toBe(false);
    expect(d.seen('e1')).toBe(false); // never tracked
  });
});
