import type { LineClient } from './line-client';
import type { IntentClassifier, Lang } from './ai/types';
import type { makeLineUserRepo } from './line-user-repo';
import type { makeMessageLog } from './message-log';
import type { SessionStore } from './session-store';
import { handleResident } from './handlers/resident';
import { handleHousekeeper } from './handlers/housekeeper';
import { continueDemo } from './handlers/demo';
import { isCommand } from './handlers/command';
import { welcome } from './flex/welcome';

export type DispatchDeps = {
  lineClient: LineClient;
  ai: IntentClassifier;
  store: SessionStore;
  lineUserRepo: ReturnType<typeof makeLineUserRepo>;
  messageLog: ReturnType<typeof makeMessageLog>;
  channelId: string;
  bookFn: (input: { facility: string; date: string; time: string }, lineUserId?: string) => Promise<{ id: string }>;
  reportFn: (input: { intent: import('./ai/types').IntentName; slots: Record<string, unknown> }, lineUserId?: string) => Promise<{ id: string }>;
  /** Bind this LINE user to a personal web account; returns the portal URL. Idempotent. */
  bindWebUser: (lineUserId: string, displayName?: string | null) => { url: string; isNew: boolean };
  /** Push a plain-text message to a specific LINE user. Used for status-change notifications. */
  pushToLineUser: (lineUserId: string, message: string) => Promise<void>;
  pushHousekeepers: (payload: { orderId: string; from: string; intent: string; summary: string }) => Promise<void>;
  /** List the resident's work orders + facility bookings (for the workorder.status intent). */
  listMyOrders: (lineUserId: string) => Promise<import('./flex/myOrders').MyOrderItem[]>;
  updateOrder: (orderId: string, patch: {
    status: 'open'|'in_progress'|'resolved'|'closed';
    acceptedBy?: string;
    rejectedBy?: string;
  }) => Promise<void>;
  runSideEffect: (call: { router: string; procedure: string; input: unknown }) => Promise<void>;
  /** Handles /commands. Returns true if the command was recognized and handled. */
  commandHandler: (text: string, ev: any, lineUser: { lineUserId: string; role: 'resident'|'housekeeper'|'admin'; language: Lang }) => Promise<boolean>;
  /** Per-user rate limiter. check() returns false when the user is over limit. */
  rateLimiter: { check: (userId: string) => boolean };
  /** Event-id de-duplication (LRU). seen() returns true if this webhookEventId was already processed. */
  eventDedupe: { seen: (id: string) => boolean };
};

export async function dispatch(events: any[], deps: DispatchDeps): Promise<void> {
  deps.store.evictExpired();

  for (const ev of events) {
    const userId = ev.source?.userId;
    if (!userId) continue;

    // ── 1. Event de-dup (before any work) ─────────────────────────────────────
    if (ev.webhookEventId && deps.eventDedupe.seen(ev.webhookEventId)) continue;

    // ── 2. Upsert lineUser ─────────────────────────────────────────────────────
    let lineUser = deps.lineUserRepo.byLineId(deps.channelId, userId);
    if (!lineUser) {
      deps.lineUserRepo.upsert({ channelId: deps.channelId, lineUserId: userId, isDemo: 1 });
      lineUser = deps.lineUserRepo.byLineId(deps.channelId, userId)!;
    }

    // ── 2.5 Lazy web-account bind ──────────────────────────────────────────────
    // bindWebUser normally fires on `follow`. But Render Free wipes the SQLite
    // on every deploy → existing followers lose their app_user_id binding and
    // would fall back to SEED_USER_ID (no push-back, all orders share one user).
    // Lazy-bind here covers the post-deploy case so the FIRST message from any
    // already-followed user re-establishes the binding without requiring them
    // to re-add the bot.
    if (!lineUser.appUserId) {
      try {
        deps.bindWebUser(userId, lineUser.displayName ?? null);
        lineUser = deps.lineUserRepo.byLineId(deps.channelId, userId)!;
      } catch (err) {
        console.error('[LINE] lazy bindWebUser failed (non-fatal)', { userId, err });
      }
    }

    // ── 3. Log inbound message (before rate-limit so abuse traffic is always auditable) ──
    deps.messageLog.write({
      lineUserId: userId,
      direction: 'inbound',
      messageType: ev.type,
      content: ev,
    });

    // ── 4. Rate limit (after lineUser so we can reply with lang-aware text) ────
    if (!deps.rateLimiter.check(userId)) {
      const lang = (lineUser.language ?? 'zh-TW') as Lang;
      const msg = lang === 'en' ? 'You are sending messages too fast. Please wait a moment.'
                : lang === 'ja' ? 'メッセージの送信が速すぎます。少々お待ちください。'
                                : '您傳送訊息的速度太快，請稍候再試 🙏';
      try {
        await deps.lineClient.replyOrPush(ev.replyToken, userId, { type: 'text', text: msg });
      } catch (err) {
        console.error('[LINE] failed to send rate-limit reply', { userId, err });
      }
      continue;
    }

    try {
      // ── 4.5 Follow event → bind web account + send welcome with portal URL ──
      if (ev.type === 'follow') {
        const lang = (lineUser.language ?? 'zh-TW') as Lang;
        let portalUrl: string | null = null;
        try {
          const bound = deps.bindWebUser(userId, lineUser.displayName ?? null);
          portalUrl = bound.url;
        } catch (err) {
          console.error('[LINE] bindWebUser on follow failed (continuing with plain welcome)', { userId, err });
        }
        try {
          await deps.lineClient.replyOrPush(ev.replyToken, userId, welcome(lang));
          if (portalUrl) {
            const portalMsg = lang === 'en'
              ? `Your private resident portal:\n${portalUrl}`
              : lang === 'ja' ? `あなた専用の住戶ポータル:\n${portalUrl}`
                              : `您的專屬住戶後台:\n${portalUrl}`;
            await deps.lineClient.replyOrPush(undefined, userId, { type: 'text', text: portalMsg });
          }
        } catch (err) {
          console.error('[LINE] failed to send welcome on follow', { userId, err });
        }
        continue;
      }

      // ── 5. Command intercept (BEFORE demo — so /demo stop works mid-demo) ────
      // Phase 6 Concern A: commands must be checked before demo intercept.
      if (ev.type === 'message' && ev.message?.type === 'text' && isCommand(ev.message.text)) {
        const handled = await deps.commandHandler(ev.message.text, ev, {
          lineUserId: userId,
          role: (lineUser.role ?? 'resident') as 'resident'|'housekeeper'|'admin',
          language: (lineUser.language ?? 'zh-TW') as Lang,
        });
        if (handled) continue;
        // If false, fall through to demo / role routing
      }

      // ── 6. Demo intercept — BEFORE role routing ────────────────────────────
      const session = deps.store.get(userId);
      if (session?.demoScriptId) {
        await continueDemo(ev, {
          store: deps.store,
          client: deps.lineClient,
          lineUser: { lineUserId: userId, language: (lineUser.language ?? 'zh-TW') as Lang },
          runSideEffect: deps.runSideEffect,
        });
        continue;  // skip normal role handlers when demo is active
      }

      // ── 7. Role routing ────────────────────────────────────────────────────
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
          reportFn: deps.reportFn,
          pushHousekeepers: deps.pushHousekeepers,
          listMyOrders: deps.listMyOrders,
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
      // admin handler added in Phase 7 (command handler covers admin commands)
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

/** True once setDispatchDeps() has run — i.e. LINE boot wiring succeeded.
 *  /health uses this so a dispatcher boot failure is visible instead of the bot
 *  being silently dead while status stays green (audit finding H5). */
export function isDispatcherConfigured(): boolean {
  return configuredDeps !== null;
}

export function resetDispatchDeps(): void {
  configuredDeps = null;
}
