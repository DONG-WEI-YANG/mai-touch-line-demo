import { describe, it, expect } from 'vitest';
import { bookingConfirm } from '../../src/server/line/flex/bookingConfirm';

describe('bookingConfirm', () => {
  it('renders facility/date/time and confirm postback', () => {
    const m = bookingConfirm({ facility:'gym', date:'2026-05-09', time:'19:00' }, 'zh-TW');
    const json = JSON.stringify(m);
    expect(json).toContain('健身房');
    expect(json).toContain('2026-05-09');
    expect(json).toContain('19:00');
    expect(json).toContain('act=confirm&intent=facility.book');
  });
});
