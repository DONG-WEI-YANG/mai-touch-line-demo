import { describe, it, expect } from 'vitest';
import { workOrderCard } from '../../src/server/line/flex/workOrderCard';

describe('workOrderCard', () => {
  it('renders order id, from, summary and 3 action postbacks', () => {
    const m = workOrderCard({ orderId:'WO-42', from:'住戶 A', intent:'facility.book',
                              summary:'健身房 19:00' }, 'zh-TW');
    const json = JSON.stringify(m);
    expect(json).toContain('WO-42');
    expect(json).toContain('act=accept&wo=WO-42');
    expect(json).toContain('act=reassign&wo=WO-42');
    expect(json).toContain('act=reject&wo=WO-42');
  });
});
