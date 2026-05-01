import type { LineClient } from './line-client';
import type { makeLineUserRepo } from './line-user-repo';
import { workOrderCard } from './flex/workOrderCard';

export function makePushHousekeepers(deps: {
  lineUserRepo: ReturnType<typeof makeLineUserRepo>;
  client: LineClient;
  channelId: string;
}) {
  return async function pushHousekeepers(payload: {
    orderId: string; from: string; intent: string; summary: string;
  }): Promise<void> {
    const housekeepers = deps.lineUserRepo.listByRole(deps.channelId, 'housekeeper');
    await Promise.all(housekeepers.map(async (h) => {
      const card = workOrderCard(payload, (h.language ?? 'zh-TW') as any);
      try {
        await deps.client.push(h.lineUserId, card);
      } catch (err) {
        console.error('[LINE] push to housekeeper failed', { hk: h.lineUserId, err });
      }
    }));
  };
}
