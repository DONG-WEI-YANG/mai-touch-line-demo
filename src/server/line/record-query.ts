import { t } from './flex/i18n';
import type { Lang } from './ai/types';
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

export function slotMessage(slots: AvailableSlot[], date: string, offset = 0, options: {facility?: string; readOnly?: boolean; lang?: Lang} = {}) {
  const lastPage = Math.max(0,Math.floor((slots.length-1)/10)*10);
  const start = Math.min(lastPage,Math.max(0,Math.floor(offset/10)*10));
  const page = slots.slice(start,start+10);
  const readOnly = options.readOnly || !options.facility;
  const context = `&fac=${encodeURIComponent(options.facility ?? '')}&date=${encodeURIComponent(date)}`;
  const button = (label: string,data: string) => ({type:'button',height:'sm',style:'secondary',action:{type:'postback',label,data}});
  const facility = options.facility ? t(`facility.${options.facility}` as any,options.lang ?? 'zh-TW') : '公設';
  return {
    type:'flex',altText:`${facility} ${date} ${readOnly?'空檔查詢':'選擇預約時段'}`,
    contents:{type:'bubble',size:'giga',
      header:{type:'box',layout:'vertical',spacing:'sm',backgroundColor:'#24221F',paddingAll:'16px',contents:[
        {type:'text',text:`${facility}｜${date}`,weight:'bold',color:'#E8D7B4',size:'lg',wrap:true},
        {type:'text',text:readOnly?'空檔查詢（僅查詢，不建立預約）':'點選時段，下一步確認預約',color:'#FFFFFF',size:'sm',wrap:true},
        {type:'text',text:page.length?`第 ${start+1}–${start+page.length} 筆，共 ${slots.length} 個時段`:'當日無可用時段',color:'#E5E0D7',size:'xs'},
      ]},
      body:{type:'box',layout:'vertical',spacing:'sm',paddingAll:'12px',contents:page.length?page.map(slot=>({
        type:'box',layout:'horizontal',paddingAll:'12px',spacing:'sm',backgroundColor:'#F5F2EB',cornerRadius:'6px',
        ...(!readOnly?{action:{type:'postback',label:slot.startTime,data:`act=chooseSlot${context}&time=${encodeURIComponent(slot.startTime)}`,displayText:`選擇 ${date} ${slot.startTime}`}}:{}),
        contents:[
          {type:'text',text:`${slot.startTime}–${slot.endTime}`,weight:'bold',size:'md',flex:3,wrap:true},
          {type:'text',text:`剩 ${slot.remainingCapacity} 名${readOnly?'':'・選擇'}`,size:'sm',color:'#8B6C35',align:'end',flex:2,wrap:true},
        ],
      })):[{type:'text',text:'請更換日期，或回首頁選擇其他設施。',wrap:true,size:'sm'}]},
      footer:{type:'box',layout:'vertical',spacing:'sm',contents:[
        ...(start>0?[button('上一頁',`slotsOffset=${start-10}${context}`)]:[]),
        ...(start+10<slots.length?[button('下一頁',`slotsOffset=${start+10}${context}`)]:[]),
        button('更換日期',`act=changeDate${context}`),
        button('回服務首頁','nav=home'),
      ]},
    },
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

