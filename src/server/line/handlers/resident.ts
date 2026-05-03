import type { SessionStore, SessionState } from '../session-store';
import type { IntentClassifier, Lang, IntentName } from '../ai/types';
import type { LineClient } from '../line-client';
import { parsePostback } from '../postback';
import { facilityCarousel } from '../flex/facilityCarousel';
import { dateTimePicker } from '../flex/dateTimePicker';
import { bookingConfirm } from '../flex/bookingConfirm';
import { bookingDone } from '../flex/bookingDone';
import { t } from '../flex/i18n';

const REQUIRED_SLOTS: Partial<Record<IntentName, string[]>> = {
  'facility.book':   ['facility', 'date', 'time'],
  'repair.report':   ['issue', 'location', 'urgency'],
  'visitor.notify':  ['visitor_name', 'visitor_count', 'date', 'time'],
  'complaint.file':  ['issue'],
};

export type ResidentDeps = {
  ai: IntentClassifier;
  client: LineClient;
  store: SessionStore;
  channelId: string;
  lineUser: { lineUserId: string; role: 'resident' | 'housekeeper' | 'admin'; language: Lang };
  bookFn: (input: { facility: string; date: string; time: string }) => Promise<{ id: string }>;
  // Generic work-order creator for non-facility intents (repair/visitor/complaint).
  // Returns the new order id for echo-back to the user.
  reportFn: (input: { intent: IntentName; slots: Record<string, unknown> }) => Promise<{ id: string }>;
  pushHousekeepers: (payload: { orderId: string; from: string; intent: string; summary: string }) => Promise<void>;
};

export async function handleResident(ev: any, deps: ResidentDeps): Promise<void> {
  const userId = deps.lineUser.lineUserId;
  const lang = deps.lineUser.language;
  let session: SessionState = deps.store.get(userId) ?? newSession(userId, lang);

  // ──── Postback branch ────
  if (ev.type === 'postback') {
    const params = parsePostback(ev.postback?.data ?? '');

    if (params.act === 'cancel') {
      deps.store.clear(userId);
      await deps.client.replyOrPush(ev.replyToken, userId,
        { type: 'text', text: t('booking.btn.cancel', lang) });
      return;
    }

    if (params.act === 'book' && params.fac) {
      session = {
        ...session, intent: 'facility.book', step: 'SLOT_FILLING',
        slots: { ...session.slots, facility: params.fac },
      };
    }

    if (params.slot && params.val) {
      session = {
        ...session,
        slots: { ...session.slots, [params.slot]: params.val },
        step: 'SLOT_FILLING',
      };
    }

    if (params.act === 'confirm' && session.step === 'CONFIRMING' && session.intent === 'facility.book') {
      session = { ...session, step: 'EXECUTING' };
      deps.store.set(userId, session);
      try {
        const order = await deps.bookFn(session.slots as any);
        await deps.client.replyOrPush(ev.replyToken, userId, bookingDone({ orderId: order.id }, lang));
        await deps.pushHousekeepers({
          orderId: order.id, from: userId, intent: session.intent,
          summary: JSON.stringify(session.slots),
        });
        deps.store.clear(userId);
        // Set a minimal IDLE record so store.get(userId)?.step === 'IDLE'
        deps.store.set(userId, { ...newSession(userId, lang), step: 'IDLE' });
      } catch (err: any) {
        // Keep extended LINE/axios detail in logs so Flex/format issues are diagnosable
        // without redeploying. Plain `err` alone hides response.data behind '[Object]'.
        const lineDetail = err?.originalError?.response?.data ?? err?.response?.data;
        console.error('[LINE] bookFn failed', {
          userId,
          slots: session.slots,
          errMsg: err?.message,
          lineStatus: err?.statusCode ?? err?.status,
          lineDetail: lineDetail ? JSON.stringify(lineDetail) : undefined,
        });
        // Roll back to CONFIRMING so the user can re-tap "Confirm" without re-entering slots
        deps.store.set(userId, { ...session, step: 'CONFIRMING' });
        await deps.client.replyOrPush(ev.replyToken, userId, { type: 'text', text: t('msg.busy', lang) });
      }
      return;
    }
  }

  // ──── Text-as-slot capture — when an intent is mid slot-filling and the
  //      next missing slot is a text-typed one (visitor_name / issue / location /
  //      urgency / visitor_count), accept the user's free-text reply as the slot
  //      value. Date / time / facility slots have dedicated postback UIs (date
  //      picker / facility carousel) and are NOT captured here.
  if (
    ev.type === 'message' && ev.message?.type === 'text' &&
    session.intent && session.step === 'SLOT_FILLING'
  ) {
    const required = REQUIRED_SLOTS[session.intent] ?? [];
    const nextMissing = required.find(k => !(k in session.slots));
    const TEXT_SLOTS = new Set(['visitor_name', 'visitor_count', 'issue', 'location', 'urgency']);
    if (nextMissing && TEXT_SLOTS.has(nextMissing)) {
      const text = (ev.message.text as string).trim();
      const value: string | number = nextMissing === 'visitor_count'
        ? (Number.isFinite(parseInt(text, 10)) ? parseInt(text, 10) : 0)
        : text;
      session = { ...session, slots: { ...session.slots, [nextMissing]: value } };
      // Fall through to slot loop below to ask next missing slot or execute.
    }
  }

  // ──── Text branch — classify if no active intent ────
  if (ev.type === 'message' && ev.message?.type === 'text' && !session.intent) {
    const text = ev.message.text as string;
    const r = await deps.ai.classify(text, { userId, history: session.history });
    session = {
      ...session,
      intent: r.intent,
      slots: { ...session.slots, ...r.slots },
      language: r.language,
      history: [...(session.history ?? []), text].slice(-4),
    };

    if (r.intent === 'small_talk') {
      deps.store.set(userId, { ...newSession(userId, lang), step: 'IDLE' });
      await deps.client.replyOrPush(ev.replyToken, userId,
        { type: 'text', text: t('msg.smallTalk', lang) });
      return;
    }
    if (r.intent === 'unknown' || r.confidence < 0.6) {
      // Intentionally clear: ambiguous input is treated as conversational reset.
      // Partial slots from this turn are discarded so the next turn can start fresh.
      deps.store.clear(userId);
      await deps.client.replyOrPush(ev.replyToken, userId,
        { type: 'text', text: t('msg.unknown', lang) });
      return;
    }
  }

  // ──── Slot accumulation + state advance ────
  const required = REQUIRED_SLOTS[session.intent ?? 'unknown'] ?? [];
  const missing = required.filter(k => !(k in session.slots));
  session = { ...session, missingSlots: missing };

  if (missing.length === 0 && session.intent === 'facility.book') {
    session = { ...session, step: 'CONFIRMING' };
    deps.store.set(userId, session);
    await deps.client.replyOrPush(ev.replyToken, userId,
      bookingConfirm(session.slots as any, lang));
    return;
  }

  // For non-facility intents (repair/visitor/complaint), all slots already gathered
  // upfront in the user's free-text message — no separate confirm step needed.
  // Immediately execute and acknowledge.
  if (missing.length === 0 && session.intent && session.intent !== 'facility.book') {
    session = { ...session, step: 'EXECUTING' };
    deps.store.set(userId, session);
    try {
      const order = await deps.reportFn({ intent: session.intent, slots: session.slots });
      const labels: Partial<Record<IntentName, string>> = {
        'repair.report':  '報修',
        'visitor.notify': '訪客通知',
        'complaint.file': '投訴',
      };
      const label = labels[session.intent] ?? '工單';
      await deps.client.replyOrPush(ev.replyToken, userId,
        { type: 'text', text: `✅ ${label}已送出,單號 ${order.id}` });
      await deps.pushHousekeepers({
        orderId: order.id, from: userId, intent: session.intent,
        summary: JSON.stringify(session.slots),
      });
      deps.store.set(userId, { ...newSession(userId, lang), step: 'IDLE' });
    } catch (err: any) {
      const lineDetail = err?.originalError?.response?.data ?? err?.response?.data;
      console.error('[LINE] reportFn failed', {
        userId, intent: session.intent, slots: session.slots,
        errMsg: err?.message, lineStatus: err?.statusCode ?? err?.status,
        lineDetail: lineDetail ? JSON.stringify(lineDetail) : undefined,
      });
      deps.store.clear(userId);
      await deps.client.replyOrPush(ev.replyToken, userId, { type: 'text', text: t('msg.busy', lang) });
    }
    return;
  }

  // Ask next missing slot
  const next = missing[0];
  if (next === 'facility') {
    session = { ...session, step: 'SLOT_FILLING' };
    deps.store.set(userId, session);
    await deps.client.replyOrPush(ev.replyToken, userId, facilityCarousel(lang));
    return;
  }
  if (next === 'date' || next === 'time') {
    session = { ...session, step: 'SLOT_FILLING' };
    deps.store.set(userId, session);
    await deps.client.replyOrPush(ev.replyToken, userId, dateTimePicker(next, lang));
    return;
  }
  if (next) {
    // generic ask for slots like issue / location / urgency / visitor_name / visitor_count
    session = { ...session, step: 'SLOT_FILLING' };
    deps.store.set(userId, session);
    const askKey = ('ask.' + next.replace('_', '.')) as any;
    await deps.client.replyOrPush(ev.replyToken, userId, { type: 'text', text: t(askKey, lang) });
    return;
  }
}

function newSession(userId: string, language: Lang): SessionState {
  return {
    userId, role: 'resident', step: 'IDLE', slots: {}, missingSlots: [], language,
    updatedAt: Date.now(),
  };
}
