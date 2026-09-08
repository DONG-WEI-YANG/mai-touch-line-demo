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

it('uses Taipei dates and readable Chinese labels', () => {
  const m = dateTimePicker('date', 'zh-TW', new Date('2026-09-08T17:00:00Z'));
  expect(m.quickReply.items[0].action).toMatchObject({ label: '今天', data: 'slot=date&val=2026-09-09', displayText: '今天' });
});
