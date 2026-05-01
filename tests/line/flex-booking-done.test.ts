import { describe, it, expect } from 'vitest';
import { bookingDone } from '../../src/server/line/flex/bookingDone';

describe('bookingDone', () => {
  it('contains orderId in altText and body', () => {
    const m = bookingDone({ orderId: 'WO-001' }, 'zh-TW');
    expect(JSON.stringify(m)).toContain('WO-001');
  });
});
