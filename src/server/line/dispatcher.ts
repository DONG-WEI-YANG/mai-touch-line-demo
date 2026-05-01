import type { LineClient } from './line-client';
import type { IntentClassifier } from './ai/types';
import type { makeLineUserRepo } from './line-user-repo';
import type { makeMessageLog } from './message-log';
import type { SessionStore } from './session-store';
import { handleResident } from './handlers/resident';

export type DispatchDeps = {
  lineClient: LineClient;
  ai: IntentClassifier;
  store: SessionStore;
  lineUserRepo: ReturnType<typeof makeLineUserRepo>;
  messageLog: ReturnType<typeof makeMessageLog>;
  channelId: string;
  bookFn: (input: { facility: string; date: string; time: string }) => Promise<{ id: string }>;
  pushHousekeepers: (payload: { orderId: string; from: string; intent: string; summary: string }) => Promise<void>;
};

export async function dispatch(events: any[], deps: DispatchDeps): Promise<void> {
  deps.store.evictExpired();

  for (const ev of events) {
    const userId = ev.source?.userId;
    if (!userId) continue;

    let lineUser = deps.lineUserRepo.byLineId(deps.channelId, userId);
    if (!lineUser) {
      deps.lineUserRepo.upsert({ channelId: deps.channelId, lineUserId: userId, isDemo: 1 });
      lineUser = deps.lineUserRepo.byLineId(deps.channelId, userId)!;
    }

    deps.messageLog.write({
      lineUserId: userId,
      direction: 'inbound',
      messageType: ev.type,
      content: ev,
    });

    try {
      if (lineUser.role === 'resident') {
        await handleResident(ev, {
          ai: deps.ai,
          client: deps.lineClient,
          store: deps.store,
          channelId: deps.channelId,
          lineUser: {
            lineUserId: userId,
            role: lineUser.role,
            language: (lineUser.language ?? 'zh-TW') as any,
          },
          bookFn: deps.bookFn,
          pushHousekeepers: deps.pushHousekeepers,
        });
      }
      // housekeeper / admin handlers added in Phase 5 / 7
    } catch (err) {
      console.error('[LINE] dispatch handler error', { userId, role: lineUser.role, err });
    }
  }
}

// ──── Configured deps (set at server boot) ────────────────────────────────────

let configuredDeps: DispatchDeps | null = null;

export function setDispatchDeps(deps: DispatchDeps): void {
  configuredDeps = deps;
}

export function getDispatchDeps(): DispatchDeps {
  if (!configuredDeps) throw new Error('LINE dispatcher not configured. Call setDispatchDeps() at boot.');
  return configuredDeps;
}

export function resetDispatchDeps(): void {
  configuredDeps = null;
}
