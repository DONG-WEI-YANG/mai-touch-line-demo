import type { Lang } from '../ai/types';

export type I18nKey =
  | 'booking.confirm.title' | 'booking.confirm.facility' | 'booking.confirm.date' | 'booking.confirm.time'
  | 'booking.btn.confirm' | 'booking.btn.edit' | 'booking.btn.cancel'
  | 'booking.done.title' | 'booking.done.orderNo' | 'booking.done.again'
  | 'facility.gym' | 'facility.pool' | 'facility.meeting_room' | 'facility.lounge' | 'facility.bbq' | 'facility.sauna'
  | 'welcome.title' | 'welcome.subtitle' | 'welcome.btn.start' | 'welcome.btn.demo'
  | 'workorder.new.title' | 'workorder.new.from' | 'workorder.new.btn.accept' | 'workorder.new.btn.reassign' | 'workorder.new.btn.reject'
  | 'workorder.status.title' | 'workorder.status.empty'
  | 'ask.facility' | 'ask.date' | 'ask.time' | 'ask.issue' | 'ask.location' | 'ask.urgency' | 'ask.visitor.name' | 'ask.visitor.count'
  | 'msg.smallTalk' | 'msg.unknown' | 'msg.busy' | 'msg.rateLimited' | 'msg.demoEnded' | 'msg.sessionReset';

const dict: Record<I18nKey, Record<Lang, string>> = {
  'booking.confirm.title':    { 'zh-TW':'預約確認', en:'Booking confirmation', ja:'予約確認' },
  'booking.confirm.facility': { 'zh-TW':'設施',     en:'Facility',             ja:'施設' },
  'booking.confirm.date':     { 'zh-TW':'日期',     en:'Date',                 ja:'日付' },
  'booking.confirm.time':     { 'zh-TW':'時段',     en:'Time',                 ja:'時間' },
  'booking.btn.confirm':      { 'zh-TW':'確認預約', en:'Confirm',              ja:'確認' },
  'booking.btn.edit':         { 'zh-TW':'修改',     en:'Edit',                 ja:'修正' },
  'booking.btn.cancel':       { 'zh-TW':'取消',     en:'Cancel',               ja:'キャンセル' },
  'booking.done.title':       { 'zh-TW':'預約成功', en:'Booked',               ja:'予約完了' },
  'booking.done.orderNo':     { 'zh-TW':'單號',     en:'Order',                ja:'注文番号' },
  'booking.done.again':       { 'zh-TW':'再預約一次', en:'Book again',         ja:'もう一度予約' },
  'facility.gym':             { 'zh-TW':'健身房',   en:'Gym',                  ja:'ジム' },
  'facility.pool':            { 'zh-TW':'游泳池',   en:'Pool',                 ja:'プール' },
  'facility.meeting_room':    { 'zh-TW':'會議室',   en:'Meeting room',         ja:'会議室' },
  'facility.lounge':          { 'zh-TW':'交誼廳',   en:'Lounge',               ja:'ラウンジ' },
  'facility.bbq':             { 'zh-TW':'BBQ 區',  en:'BBQ',                  ja:'BBQ' },
  'facility.sauna':           { 'zh-TW':'三溫暖',   en:'Sauna',                ja:'サウナ' },
  'welcome.title':            { 'zh-TW':"歡迎使用 m'AI Touch", en:"Welcome to m'AI Touch", ja:"m'AI Touchへようこそ" },
  'welcome.subtitle':         { 'zh-TW':'AI 管家為您服務 24/7', en:'AI housekeeper at your service 24/7', ja:'AI執事が24時間対応' },
  'welcome.btn.start':        { 'zh-TW':'開始使用', en:'Get started',          ja:'はじめる' },
  'welcome.btn.demo':         { 'zh-TW':'觀看 Demo', en:'View demo',           ja:'デモを見る' },
  'workorder.new.title':      { 'zh-TW':'新工單',   en:'New work order',       ja:'新しい依頼' },
  'workorder.new.from':       { 'zh-TW':'住戶',     en:'Resident',             ja:'住人' },
  'workorder.new.btn.accept':   { 'zh-TW':'接單',   en:'Accept',               ja:'受ける' },
  'workorder.new.btn.reassign': { 'zh-TW':'轉派',   en:'Reassign',             ja:'転送' },
  'workorder.new.btn.reject':   { 'zh-TW':'拒絕',   en:'Reject',               ja:'拒否' },
  'workorder.status.title':   { 'zh-TW':'我的工單', en:'My work orders',       ja:'依頼一覧' },
  'workorder.status.empty':   { 'zh-TW':'目前沒有工單', en:'No active orders', ja:'依頼はありません' },
  'ask.facility':             { 'zh-TW':'要預約哪個設施?', en:'Which facility?', ja:'どの施設?' },
  'ask.date':                 { 'zh-TW':'哪一天?',   en:'Which date?',         ja:'いつ?' },
  'ask.time':                 { 'zh-TW':'幾點?',     en:'What time?',          ja:'何時?' },
  'ask.issue':                { 'zh-TW':'發生什麼問題?', en:"What's the issue?", ja:'何の問題?' },
  'ask.location':             { 'zh-TW':'在哪個位置?', en:'Where?',            ja:'場所は?' },
  'ask.urgency':              { 'zh-TW':'緊急程度?', en:'Urgency?',            ja:'緊急度?' },
  'ask.visitor.name':         { 'zh-TW':'訪客姓名?', en:'Visitor name?',       ja:'訪問者の名前?' },
  'ask.visitor.count':        { 'zh-TW':'幾位訪客?', en:'How many visitors?',  ja:'何人?' },
  'msg.smallTalk':            { 'zh-TW':'您好!有什麼可以為您服務?', en:'Hi! How can I help?', ja:'こんにちは!何かお手伝いできますか?' },
  'msg.unknown':              { 'zh-TW':'不太懂您的意思,可以再說一次嗎?', en:"Sorry, I didn't catch that.", ja:'すみません、もう一度お願いします。' },
  'msg.busy':                 { 'zh-TW':'系統忙碌,請稍候再試 🙏', en:'System busy, please try again 🙏', ja:'システムが混雑しています' },
  'msg.rateLimited':          { 'zh-TW':'已達 demo 用量上限,請稍後再試', en:'Demo rate limit reached', ja:'デモ利用上限に達しました' },
  'msg.demoEnded':            { 'zh-TW':'Demo 已終止',  en:'Demo ended',       ja:'デモ終了' },
  'msg.sessionReset':         { 'zh-TW':'對話已重置,請重新開始', en:'Session reset, please start over', ja:'セッションをリセットしました' },
};

export function t(key: I18nKey, lang: Lang): string {
  const entry = dict[key];
  if (!entry) { console.warn('[i18n] missing key', key); return key as string; }
  return entry[lang] ?? entry['zh-TW'];
}
