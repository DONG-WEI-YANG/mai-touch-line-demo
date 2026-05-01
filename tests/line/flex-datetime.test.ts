import { describe, it, expect } from 'vitest';
import { dateTimePicker } from '../../src/server/line/flex/dateTimePicker';

describe('dateTimePicker', () => {
  it('returns text + quick reply with picker action', () => {
    const m = dateTimePicker('time', 'zh-TW');
    expect(m.type).toBe('text');
    expect(m.text).toBe('幾點?');
    expect(m.quickReply.items.some((i: any) => i.action.type === 'datetimepicker')).toBe(true);
  });
});
