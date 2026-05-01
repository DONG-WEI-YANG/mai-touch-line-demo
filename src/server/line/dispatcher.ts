import type { LineClient } from './line-client';
import type { IntentClassifier } from './ai/types';
import type { makeLineUserRepo } from './line-user-repo';
import type { makeMessageLog } from './message-log';
import type { SessionStore } from './session-store';
import { handleResident } from './handlers/resident';
import { handleHousekeeper } from './handlers/housekeeper';
import { continueDemo } from './handlers/demo';

export type DispatchDeps = {
  lineClient: LineClient;
  ai: IntentClassifier;
  store: SessionStore;
  lineUserRepo: ReturnType<typeof makeLineUserRepo>;
  messageLog: ReturnType<typeof makeMessageLog>;
  channelId: string;
  bookFn: (input: { facility: string; date: string; time: string }) => Promise<{ id: string }>;
  pushHousekeepers: (payload: { orderId: string; from: string; intent: string; summary: string }) => Promise<void>;
  updateOrder: (orderId: string, patch: {
    status: 'open'|'in_progress'|'resolved'|'closed';
    acceptedBy?: string;
    rejectedBy?: string;
  }) => Promise<void>;
  runSideEffect: (call: { router: string; procedure: string; input: unknown }) => Promise<void>;
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
      // Demo intercept — BEFORE role routing so demo works for any role
      const session = deps.store.get(userId);
      if (session?.demoScriptId) {
        await continueDemo(ev, {
          store: deps.store,
          client: deps.lineClient,
          lineUser: { lineUserId: userId, language: (lineUser.language ?? 'zh-TW') as any },
          runSideEffect: deps.runSideEffect,
        });
        continue;  // skip normal role handlers when demo is active
      }

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
      if (lineUser.role === 'housekeeper') {
        await handleHousekeeper(ev, {
          client: deps.lineClient,
          updateOrder: deps.updateOrder,
          lineUser: {
            lineUserId: userId,
            role: lineUser.role,
            language: (lineUser.language ?? 'zh-TW') as any,
          },
        });
      }
      // admin handler added in Phase 7
    } catch (err) {
      console.error('[LINE] dispatch handler error', { userId, role: lineUser.role, err });
      // Best-effort error reply — handler may have already consumed reply token, replyOrPush falls back to push
      try {
        const lang = (lineUser.language ?? 'zh-TW') as 'zh-TW' | 'en' | 'ja';
        await deps.lineClient.replyOrPush(ev.replyToken, userId,
          { type: 'text', text: lang === 'en' ? 'Sorry, something went wrong. Please try again.'
                              : lang === 'ja' ? '申し訳ありません、エラーが発生しました'
                                              : '不好意思,系統剛剛出了點問題,請再試一次 🙏' });
      } catch (replyErr) {
        console.error('[LINE] failed to send error reply', { userId, replyErr });
      }
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
