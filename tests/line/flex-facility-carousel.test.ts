import { describe, it, expect } from 'vitest';
import { facilityCarousel } from '../../src/server/line/flex/facilityCarousel';

describe('facilityCarousel', () => {
  it('returns 6 bubbles with correct postback data', () => {
    const m = facilityCarousel('zh-TW');
    expect(m.contents.type).toBe('carousel');
    expect(m.contents.contents.length).toBe(6);
    const acts = m.contents.contents.map((b: any) =>
      b.footer.contents[0].action.data);
    expect(acts).toContain('act=book&fac=gym');
    expect(acts).toContain('act=book&fac=pool');
  });
});
