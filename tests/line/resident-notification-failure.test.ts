import { describe, it, expect, vi } from 'vitest';
import { handleResident, type ResidentDeps } from '../../src/server/line/handlers/resident';
import { SessionStore } from '../../src/server/line/session-store';

describe('committed resident requests survive notification failure', () => {
  for (const intent of ['facility.book', 'repair.report'] as const) {
    for (const failure of ['reply', 'push'] as const) {
      it(`${intent} remains complete when ${failure} fails`, async () => {
        const store = new SessionStore({ ttlMs: 60_000 });
        const slots = intent === 'facility.book'
          ? { facility: 'gym', date: '2026-09-20', time: '19:00' }
          : { issue: '漏水', location: '大廳', urgency: '一般' };
        store.set('U1', { userId: 'U1', role: 'resident', language: 'zh-TW',
          intent, step: 'CONFIRMING', slots, missingSlots: [], updatedAt: Date.now() });
        const replies: unknown[] = [];
        const notifications: unknown[] = [];
        const saved: string[] = [];
        const deps = {
          store, channelId: 'C', lineUser: { lineUserId: 'U1', role: 'resident', language: 'zh-TW' },
          ai: { classify: vi.fn() },
          client: { replyOrPush: async (_token: string, _user: string, message: unknown) => {
            replies.push(message);
            if (failure === 'reply') throw new Error('delivery unavailable');
          } },
          bookFn: async () => { saved.push('booking'); return { id: 'BK-42' }; },
          reportFn: async () => { saved.push('report'); return { id: 'WO-42' }; },
          pushHousekeepers: async (payload: unknown) => {
            notifications.push(payload);
            if (failure === 'push') throw new Error('push unavailable');
          },
          listMyOrders: async () => [],
        } as unknown as ResidentDeps;
        const event = { type: 'postback', replyToken: 'rt', postback: { data: 'act=confirm' } };
        await expect(handleResident(event, deps)).resolves.toBeUndefined();
        expect(store.get('U1')?.step).toBe('IDLE');
        expect(replies).toHaveLength(1);
        expect(notifications).toHaveLength(1);
        await handleResident(event, deps);
        expect(saved).toHaveLength(1);
      });
    }
  }
});
