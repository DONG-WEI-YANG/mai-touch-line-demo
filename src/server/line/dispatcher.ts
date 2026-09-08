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
import { serviceHome, recordResult, homeQuickReply } from './flex/serviceHome';
import { facilityCarousel } from './flex/facilityCarousel';
import { parsePostback } from './postback';

export type DispatchDeps = {
  queryRecords?: (text: string, lineUserId: string) => Promise<string | undefined>;
  getAvailableSlots?: import('./handlers/resident').ResidentDeps['getAvailableSlots'];
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
          await deps.lineClient.replyOrPush(ev.replyToken, userId, [welcome(lang), serviceHome((lineUser.role ?? 'resident') as any,lang)]);
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

      // Explicit navigation is deterministic and never consumes model tokens.
      const p = ev.type === 'postback' ? parsePostback(ev.postback?.data ?? '') : {};
      const menuText = ev.type === 'message' && ev.message?.type === 'text' ? ev.message.text.trim() : '';
      if (['服務首頁','主選單','選單','開始使用'].includes(menuText)) p.nav='home';
      const lang=(lineUser.language ?? 'zh-TW') as Lang;
      const servicePhrases:Record<string,string>={'我要報修':'repair.report','我要登記訪客':'visitor.notify','我要反映問題':'complaint.file'};
      if (servicePhrases[menuText]) p.flow=servicePhrases[menuText];
      if (p.nav) {
        deps.store.clear(userId);
        let message: any;
        if (p.nav==='home') message=serviceHome((lineUser.role ?? 'resident') as any,lang);
        if (p.nav==='facilities' || p.nav==='availability') message=facilityCarousel(lang,p.nav==='availability' || lineUser.role!=='resident');
        if (p.nav==='portal') {
          const portal=deps.bindWebUser(userId,lineUser.displayName);
          message={type:'text',text:'開啟您的後台，查看行事曆與服務紀錄。',quickReply:{items:[
            {type:'action',action:{type:'uri',label:'開啟後台',uri:portal.url}},...homeQuickReply().items,
          ]}};
        }
        if (p.nav==='visitors' || p.nav==='services') {
          const actions=p.nav==='visitors'
            ? [['訪客紀錄','查詢訪客'],['車號紀錄','查詢車號']]
            : [['工單進度','查詢工單']];
          const items:any[]=actions.map(([label,query])=>({type:'action',action:{type:'postback',label,data:`query=${encodeURIComponent(query)}`}}));
          if (lineUser.role==='resident') {
            const flows=p.nav==='visitors' ? [['登記訪客','visitor.notify']] : [['我要報修','repair.report'],['反映問題','complaint.file']];
            for (const [label,flow] of flows) items.push({type:'action',action:{type:'postback',label,data:`flow=${flow}`,displayText:label}});
          }
          message={type:'text',text:p.nav==='visitors'?'請選擇訪客或車號服務':'請選擇需要的服務',quickReply:{items:[...items,...homeQuickReply().items]}};
        }
        const query=p.nav==='bookings'?'查詢空間預約單':p.nav==='workorders'?'查詢工單':undefined;
        if (query && deps.queryRecords) message=recordResult(await deps.queryRecords(query,userId) ?? '查無紀錄');
        if (message) {
          await deps.lineClient.replyOrPush(ev.replyToken,userId,message);
          continue;
        }
      }
      if (p.query && deps.queryRecords) {
        const response=await deps.queryRecords(p.query,userId);
        await deps.lineClient.replyOrPush(ev.replyToken,userId,recordResult(response ?? '請從服務首頁選擇查詢項目'));
        continue;
      }
      if (lineUser.role==='resident' && ['visitor.notify','repair.report','complaint.file'].includes(p.flow)) {
        deps.store.set(userId,{userId,role:'resident',language:lang,updatedAt:Date.now(),step:'SLOT_FILLING',slots:{},missingSlots:[],intent:p.flow as any});
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
      if (ev.type === 'message' && ev.message?.type === 'text' && deps.queryRecords) {
        const response = await deps.queryRecords(ev.message.text, userId);
        if (response !== undefined) {
          await deps.lineClient.replyOrPush(ev.replyToken, userId, recordResult(response));
          continue;
        }
      }
      if (lineUser.role === 'resident' || p.act==='availability' || (session?.slots.queryOnly && p.act!=='book')) {
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
          getAvailableSlots: deps.getAvailableSlots,
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
          { type: 'text', quickReply:homeQuickReply(), text: lang === 'en' ? 'Sorry, something went wrong. Please try again.'
                              : lang === 'ja' ? '申し訳ありません、エラーが発生しました'
                                              : '目前無法完成操作，請回服務首頁重試。' });
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
