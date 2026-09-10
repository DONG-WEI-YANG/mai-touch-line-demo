import type { SessionStore, SessionState } from '../session-store';
import type { IntentClassifier, Lang, IntentName } from '../ai/types';
import { AiUnavailableError } from '../ai/types';
import { recognizeFacilityPhrase } from '../ai/facility-phrases';
import { slotMessage, type AvailableSlot } from '../record-query';
import type { LineClient } from '../line-client';
import { parsePostback } from '../postback';
import { facilityCarousel } from '../flex/facilityCarousel';
import { dateTimePicker } from '../flex/dateTimePicker';
import { bookingConfirm } from '../flex/bookingConfirm';
import { bookingDone } from '../flex/bookingDone';
import { serviceMenu } from '../flex/serviceMenu';
import { myOrders, type MyOrderItem } from '../flex/myOrders';
import { t } from '../flex/i18n';
import { homeQuickReply, serviceActions } from '../flex/serviceHome';

const REQUIRED_SLOTS: Partial<Record<IntentName, string[]>> = {
  'facility.book':   ['facility', 'date', 'time'],
  'repair.report':   ['issue', 'location', 'urgency'],
  'visitor.notify':  ['visitor_name', 'visitor_count', 'date', 'time'],
  'complaint.file':  ['issue'],
};

export type ResidentDeps = {
  getAvailableSlots?: (facility: string, date: string) => Promise<AvailableSlot[]>;
  ai: IntentClassifier;
  client: LineClient;
  store: SessionStore;
  channelId: string;
  lineUser: { lineUserId: string; role: 'resident' | 'housekeeper' | 'admin'; language: Lang };
  bookFn: (input: { facility: string; date: string; time: string }, lineUserId?: string) => Promise<{ id: string }>;
  // Generic work-order creator for non-facility intents (repair/visitor/complaint).
  // Returns the new order id for echo-back to the user.
  reportFn: (input: { intent: IntentName; slots: Record<string, unknown> }, lineUserId?: string) => Promise<{ id: string }>;
  pushHousekeepers: (payload: { orderId: string; from: string; intent: string; summary: string }) => Promise<void>;
  // Returns the resident's work orders + facility bookings for the workorder.status intent.
  listMyOrders: (lineUserId: string) => Promise<MyOrderItem[]>;
};

// Delivery failure cannot undo a committed request or invite another write.
// Each recipient is attempted independently; failures retain the order ID in logs.
async function deliverCommittedNotification(orderId: string, recipient: string, send: () => Promise<unknown>) {
  try {
    await send();
  } catch (error) {
    console.error('[LINE] committed request notification failed', { orderId, recipient, error });
  }
}

export async function handleResident(ev: any, deps: ResidentDeps): Promise<void> {
  const userId = deps.lineUser.lineUserId;
  const lang = deps.lineUser.language;
  let session: SessionState = deps.store.get(userId) ?? newSession(userId, lang);

  // ──── Postback branch ────
  if (ev.type === 'postback') {
    const params = parsePostback(ev.postback?.data ?? '');
    const slotCard = (slots: AvailableSlot[],offset=0) => slotMessage(slots,String(session.slots.date),offset,{facility:String(session.slots.facility),readOnly:deps.lineUser.role!=='resident',lang});
    if ((params.act==='chooseSlot' || params.slotsOffset || params.act==='changeDate') && params.date &&
        (params.fac!==session.slots.facility || params.date!==session.slots.date)) {
      await deps.client.replyOrPush(ev.replyToken,userId,serviceActions('這張時段卡已過期','請重新查詢設施與日期，避免預約到其他時段。',[{type:'postback',label:'重新查空時段',data:'nav=availability'}]));
      return;
    }
    if (params.act==='chooseSlot') {
      if (deps.lineUser.role!=='resident') {
        await deps.client.replyOrPush(ev.replyToken,userId,serviceActions('物業空檔查詢','此入口僅供查詢，請由住戶確認預約。',[]));
        return;
      }
      if (!params.fac || !params.date || params.fac!==session.slots.facility || params.date!==session.slots.date || !deps.getAvailableSlots) {
        await deps.client.replyOrPush(ev.replyToken,userId,serviceActions('請重新選擇時段','目前沒有有效的設施與日期。',[{type:'postback',label:'查空時段',data:'nav=availability'}]));
        return;
      }
      const slots=await deps.getAvailableSlots(params.fac,params.date);
      if (!slots.some(slot=>slot.startTime===params.time && slot.remainingCapacity>0)) {
        await deps.client.replyOrPush(ev.replyToken,userId,[{type:'text',text:'這個時段已無名額，請重新選擇。'},slotCard(slots)]);
        return;
      }
      const {queryOnly: _queryOnly,...bookingSlots}=session.slots;
      session={...session,intent:'facility.book',step:'CONFIRMING',slots:{...bookingSlots,time:params.time},missingSlots:[]};
      deps.store.set(userId,session);
      await deps.client.replyOrPush(ev.replyToken,userId,bookingConfirm(session.slots as any,lang));
      return;
    }

    if (params.act === 'changeDate' || params.act === 'edit') {
      delete session.slots.date;
      delete session.slots.time;
    }
    if (params.slotsOffset && session.slots.facility && session.slots.date && deps.getAvailableSlots) {
      const offset = Number(params.slotsOffset);
      if (Number.isInteger(offset) && offset >= 0) {
        const slots = await deps.getAvailableSlots(String(session.slots.facility), String(session.slots.date));
        const msg=slotCard(slots,offset);
        await deps.client.replyOrPush(ev.replyToken, userId, msg);
        return;
      }
    }
    if (params.picker === '1' && (params.slot === 'date' || params.slot === 'time')) {
      const value = ev.postback?.params?.[params.slot];
      if (typeof value === 'string' && (params.slot === 'date'
        ? /^\d{4}-\d{2}-\d{2}$/.test(value) : /^\d{2}:\d{2}$/.test(value))) params.val = value;
    }

    if (params.act === 'cancel') {
      deps.store.clear(userId);
      await deps.client.replyOrPush(ev.replyToken, userId,
        { type: 'text', text: t('booking.btn.cancel', lang), quickReply:homeQuickReply(session.intent === 'facility.book' ? 'booking' : session.intent === 'visitor.notify' ? 'visitors' : 'services') });
      return;
    }

    if ((params.act === 'book' || params.act === 'availability') && params.fac) {
      session = {
        ...session, intent: 'facility.book', step: 'SLOT_FILLING',
        slots: { facility: params.fac, ...(params.act === 'availability' ? { queryOnly:true } : {}) },
      };
    }

    if (params.slot && params.val) {
      if (params.slot === 'date') delete session.slots.time;
      session = {
        ...session,
        slots: { ...session.slots, [params.slot]: params.val },
        step: 'SLOT_FILLING',
      };
    }

    if (params.act === 'confirm' && !session.slots.queryOnly && session.step === 'CONFIRMING' && session.intent === 'facility.book') {
      session = { ...session, step: 'EXECUTING' };
      deps.store.set(userId, session);
      try {
        const order = await deps.bookFn(session.slots as any, userId);
        deps.store.set(userId, newSession(userId, lang));
        await deliverCommittedNotification(order.id, 'resident', () => deps.client.replyOrPush(ev.replyToken, userId, bookingDone({ orderId: order.id }, lang)));
        await deliverCommittedNotification(order.id, 'housekeepers', () => deps.pushHousekeepers({
          orderId: order.id, from: userId, intent: session.intent,
          summary: JSON.stringify(session.slots),
        }));
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
    const value = String(ev.message.text).trim();
    if (nextMissing === 'facility') {
      const recognized = recognizeFacilityPhrase(value, lang);
      if (recognized?.slots.facility) session.slots.facility = recognized.slots.facility;
    }
    if (nextMissing === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) session.slots.date = value;
    if (nextMissing === 'time' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) session.slots.time = value;
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
    let r;
    try {
      r = recognizeFacilityPhrase(text, lang) ?? await deps.ai.classify(text, { userId, history: session.history });
      if (deps.store.get(userId)?.intent) return;
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
      // Do not let a late failed request overwrite another event's progress.
      if (deps.store.get(userId)?.intent) return;
      await deps.client.replyOrPush(ev.replyToken, userId, [serviceMenu(lang), facilityCarousel(lang)]);
      return;
    }
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
      // Ambiguous input → reset and offer a quick-reply service menu so the user
      // is one tap from any flow instead of stuck re-phrasing. Each button sends
      // a phrase the classifier then handles confidently.
      deps.store.clear(userId);
      await deps.client.replyOrPush(ev.replyToken, userId, serviceMenu(lang));
      return;
    }
  }

  // ──── Query / list intents — terminal, never create work orders ────
  // (workorder.status / facility.list / facility.cancel have no required slots,
  //  so they'd otherwise fall through to the reportFn branch and create a junk
  //  "[workorder] demo" / "[facility] demo" order.)
  if (session.intent === 'facility.list') {
    deps.store.set(userId, { ...newSession(userId, lang), step: 'IDLE' });
    await deps.client.replyOrPush(ev.replyToken, userId, facilityCarousel(lang));
    return;
  }
  if (session.intent === 'facility.cancel') {
    deps.store.set(userId, { ...newSession(userId, lang), step: 'IDLE' });
    await deps.client.replyOrPush(ev.replyToken, userId, serviceActions('取消預約', t('facility.cancel.howto', lang), [
      { type: 'postback', label: '查看我的預約', data: 'nav=bookings' },
      { type: 'postback', label: '開啟 Web 管理預約', data: 'nav=portal' },
    ], 'booking'));
    return;
  }
  if (session.intent === 'workorder.status') {
    deps.store.set(userId, { ...newSession(userId, lang), step: 'IDLE' });
    let items: MyOrderItem[] = [];
    try {
      items = await deps.listMyOrders(userId);
    } catch (err) {
      console.error('[LINE] listMyOrders failed', { userId, err });
      await deps.client.replyOrPush(ev.replyToken, userId, { type: 'text', text: t('msg.busy', lang) });
      return;
    }
    await deps.client.replyOrPush(ev.replyToken, userId, myOrders(items, lang));
    return;
  }

  // ──── Slot accumulation + state advance ────
  if (session.slots.queryOnly && session.slots.facility && session.slots.date && deps.getAvailableSlots) {
    const slots = await deps.getAvailableSlots(String(session.slots.facility), String(session.slots.date));
    const msg = slotMessage(slots, String(session.slots.date),0,{facility:String(session.slots.facility),readOnly:deps.lineUser.role!=='resident',lang});
    deps.store.set(userId, session);
    await deps.client.replyOrPush(ev.replyToken,userId,msg);
    return;
  }
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
      const order = await deps.reportFn({ intent: session.intent, slots: session.slots }, userId);
      deps.store.set(userId, newSession(userId, lang));
      const labels: Partial<Record<IntentName, string>> = {
        'repair.report':  '報修',
        'visitor.notify': '訪客通知',
        'complaint.file': '投訴',
      };
      const label = labels[session.intent] ?? '工單';
      await deliverCommittedNotification(order.id, 'resident', () => deps.client.replyOrPush(ev.replyToken, userId,
        { type: 'text', text: `✅ ${label}已送出,單號 ${order.id}` }));
      await deliverCommittedNotification(order.id, 'housekeepers', () => deps.pushHousekeepers({
        orderId: order.id, from: userId, intent: session.intent,
        summary: JSON.stringify(session.slots),
      }));
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
    if (next === 'time' && session.intent === 'facility.book' && deps.getAvailableSlots) {
      const slots = await deps.getAvailableSlots(String(session.slots.facility), String(session.slots.date));
      await deps.client.replyOrPush(ev.replyToken, userId, slotMessage(slots, String(session.slots.date),0,{facility:String(session.slots.facility),readOnly:deps.lineUser.role!=='resident',lang}));
    } else await deps.client.replyOrPush(ev.replyToken, userId, dateTimePicker(next, lang));
    return;
  }
  if (next) {
    // generic ask for slots like issue / location / urgency / visitor_name / visitor_count
    session = { ...session, step: 'SLOT_FILLING' };
    deps.store.set(userId, session);
    const askKey = ('ask.' + next.replace('_', '.')) as any;
    const label = session.intent === 'repair.report' ? '報修服務' : session.intent === 'visitor.notify' ? '訪客登記' : '反映問題';
    const examples: Record<string,string> = {issue:'例如：冷氣不冷、電梯異常',location:'例如：A 棟 3 樓走廊',urgency:'例如：一般、急件',visitor_name:'請填寫訪客姓名',visitor_count:'請填寫來訪人數，例如：2'};
    await deps.client.replyOrPush(ev.replyToken, userId, serviceActions(`${label}｜${required.length - missing.length + 1} / ${required.length}`, `${t(askKey, lang)}\n請在訊息欄輸入並送出。${examples[next] ?? ''}`, [{type:'postback',label:'取消填寫',data:'act=cancel'}],session.intent === 'visitor.notify' ? 'visitors' : 'services'));
    return;
  }
}

function newSession(userId: string, language: Lang): SessionState {
  return {
    userId, role: 'resident', step: 'IDLE', slots: {}, missingSlots: [], language,
    updatedAt: Date.now(),
  };
}
