import { amenitiesRouter } from '../routers/amenities';
import { recognizeFacilityPhrase } from './ai/facility-phrases';
import type { makeRecordLinks, RecordActor, LinkedRecord } from './record-links';

export type AvailableSlot = { startTime: string; endTime: string; remainingCapacity: number };
export async function availableSlots(amenityId: number, date: string, now = new Date()): Promise<AvailableSlot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('日期請使用 YYYY-MM-DD');
  const local = new Date(now.getTime() + 8 * 3600000).toISOString();
  const today = local.slice(0, 10);
  if (date < today) return [];
  const slots = await amenitiesRouter.createCaller({} as any).getSlots({ amenityId, date });
  return slots.filter(s => s.available && (date > today || s.startTime > local.slice(11, 16)));
}

export function slotMessage(slots: AvailableSlot[], date: string, offset = 0) {
  const page = slots.slice(offset, offset + 10);
  return {
    type: 'text',
    text: page.length ? `${date} 可預約時段（剩餘名額）\n${page.map(s => `${s.startTime}–${s.endTime}：${s.remainingCapacity}`).join('\n')}\n送出時會再次確認名額。` : `${date} 沒有可預約時段，請選擇其他日期。`,
    quickReply: { items: [
      ...page.map(s => ({ type: 'action', action: { type: 'postback', label: s.startTime, data: `slot=time&val=${s.startTime}`, displayText: s.startTime } })),
      ...(offset + 10 < slots.length ? [{ type: 'action', action: { type: 'postback', label: '更多時段', data: `slotsOffset=${offset + 10}` } }] : []),
      { type: 'action', action: { type: 'postback', label: '更換日期', data: 'act=changeDate' } },
    ] },
  };
}

export function makeRecordQuery(deps: {
  records: ReturnType<typeof makeRecordLinks>;
  actor: (lineUserId: string) => RecordActor;
  resolveAmenityId: (name: string) => Promise<number | undefined>;
}) {
  const format = (rows: LinkedRecord[]) => rows.length ? rows.map(r => `${r.ref}｜${r.detail}`).join('\n').slice(0, 4500) : '查無紀錄';
  return async (text: string, lineUserId: string): Promise<string | undefined> => {
    const input = text.trim();
    if (!/^(查詢|查|關聯)/.test(input)) return;
    const actor = deps.actor(lineUserId);
    const link = /^關聯\s+((?:(?:BK|V|P|WO)-\d+\s*){2,10})$/i.exec(input);
    if (link) return '已關聯：\n' + format(deps.records.link(link[1].toUpperCase().match(/(?:BK|V|P|WO)-\d+/g)!, actor));
    const ref = /^(?:查詢|查)\s*((?:BK|V|P|WO)-\d+)$/i.exec(input);
    if (ref) return '紀錄與關聯：\n' + format(deps.records.related(ref[1].toUpperCase(), actor));
    if (/^(?:查詢|查)(?:我的)?工單(?:進度)?$/.test(input)) return format(deps.records.list('WO', actor));
    const plate = /^(?:查詢|查)車號\s*([A-Za-z0-9-]{2,16})$/.exec(input);
    if (plate) {
      const rows = deps.records.list('P', actor, plate[1]);
      const linked = rows.flatMap(r => deps.records.related(r.ref, actor));
      return format([...new Map(linked.map(r => [r.ref, r])).values()]);
    }
    if (/^(?:查詢|查)(?:我的)?(?:空間預約單|公設預約|預約單|預約)$/.test(input)) return format(deps.records.list('BK', actor));
    if (/^(?:查詢|查)(?:我的)?訪客$/.test(input)) return format(deps.records.list('V', actor));
    if (/^(?:查詢|查)(?:我的)?(?:車號|停車紀錄)$/.test(input)) return format(deps.records.list('P', actor));
    const free = /^(?:查詢|查)(?:空檔|空的時段|可用時段)\s*(\S+)\s+(\d{4}-\d{2}-\d{2})$/.exec(input);
    if (free) {
      const facility = recognizeFacilityPhrase(free[1])?.slots.facility ?? free[1];
      const id = await deps.resolveAmenityId(facility);
      if (!id) return '找不到這個公設，請輸入完整設施名稱。';
      const slots = await availableSlots(id, free[2]);
      return slots.length ? `${free[1]} ${free[2]} 可預約時段：\n` + slots.map(s => `${s.startTime}–${s.endTime} 剩餘 ${s.remainingCapacity}`).join('\n').slice(0, 4300) : '當日沒有可預約時段。';
    }
    if (/空檔|空的時段|可用時段|關聯/.test(input) || input === '查詢') return '查空檔：查空檔 泳池 YYYY-MM-DD\n查預約：查詢空間預約單\n查訪客：查詢訪客\n查單據：查詢 BK-1\n查車號：查詢車號 ABC-1234\n串聯：關聯 BK-1 V-2 P-3\n單號請替換成實際紀錄；清單最多顯示最近 20 筆。';
  };
}

