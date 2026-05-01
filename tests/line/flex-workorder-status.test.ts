import { describe, it, expect } from 'vitest';
import { workOrderStatus } from '../../src/server/line/flex/workOrderStatus';

describe('workOrderStatus', () => {
  it('returns text message when no orders', () => {
    const m = workOrderStatus([], 'zh-TW');
    expect(m.type).toBe('text');
  });
  it('returns flex carousel with up to 5 orders', () => {
    const orders = Array.from({ length: 7 }, (_, i) => ({
      id: `WO-${i}`, facility: 'gym' as const, date: '2026-05-09', time: '19:00',
      status: 'pending' as const,
    }));
    const m = workOrderStatus(orders, 'zh-TW');
    expect((m as any).contents.type).toBe('carousel');
    expect((m as any).contents.contents.length).toBe(5);  // capped at 5
  });
});
