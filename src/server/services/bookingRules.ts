import { taipeiToday } from '../../lib/booking-calendar';
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3));
export function validateBookingWindow(input:{date:string;startTime:string;endTime:string;guestCount:number},schedule:{openTime:string;closeTime:string;slotDurationMinutes:number},now=new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10)!==input.date) throw new Error('預約日期無效');
  if (![input.startTime,input.endTime,schedule.openTime,schedule.closeTime].every(value=>TIME.test(value))) throw new Error('時間格式需為 HH:MM');
  const s=minutes(input.startTime),e=minutes(input.endTime),o=minutes(schedule.openTime),c=minutes(schedule.closeTime),d=schedule.slotDurationMinutes;
  if (!Number.isInteger(d)||d<=0||c<=o) throw new Error('設施開放時段設定無效');
  if (s<o||e>c||e<=s||(s-o)%d!==0||(e-s)%d!==0) throw new Error('預約須符合設施開放時間與時段長度');
  if (!Number.isSafeInteger(input.guestCount)||input.guestCount<1) throw new Error('預約人數無效');
  const today=taipeiToday(now),localTime=new Date(now.getTime()+8*3600000).toISOString().slice(11,16);
  if (input.date<today||(input.date===today&&input.startTime<=localTime)) throw new Error('不可預約已過去的時段');
}
