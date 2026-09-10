import type Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import type {NotificationEvent} from './notificationOutbox';
import {workOrderCard} from '../line/flex/workOrderCard';

type PushClient={push:(userId:string,message:unknown,retryKey?:string)=>Promise<void>};
function retryKey(eventId:string,recipient:string) {
 const h=createHash('sha256').update(`${eventId}:${recipient}`).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
/** Snapshot fan-out and message once; successful recipients never resend on a later retry. */
export function makeOutboxDelivery(sqlite:Database.Database,channelId:string,client:PushClient) {
 return async(event:NotificationEvent)=>{
  sqlite.transaction(()=>{
   if(sqlite.prepare('SELECT 1 FROM notification_deliveries WHERE event_id=? LIMIT 1').get(event.id))return;
   const payload=JSON.parse(event.payload) as Record<string,string|number>;
   const created=event.kind.endsWith('.created');
   const users=sqlite.prepare(created?"SELECT line_user_id,language FROM line_user WHERE channel_id=? AND role='housekeeper'":"SELECT line_user_id,language FROM line_user WHERE channel_id=? AND app_user_id=?").all(...(created?[channelId]:[channelId,event.user_id])) as {line_user_id:string;language:string|null}[];
   const booking=event.kind.startsWith('booking.');
   const ref=`${booking?'BK':String(payload.title??'').startsWith('[visitor]')?'V':'WO'}-${event.entity_id}`;
   const statusLabels:Record<string,string>={confirmed:'已確認',pending:'待確認',cancelled:'已取消',completed:'已完成',open:'已建立',in_progress:'處理中',resolved:'已完成',closed:'已關閉'};
   const owner=sqlite.prepare('SELECT name FROM users WHERE id=?').get(event.user_id) as {name?:string}|undefined;
   for(const user of users) {
    const message=created?workOrderCard({orderId:ref,from:owner?.name||`住戶 #${event.user_id}`,intent:booking?'facility.book':ref.startsWith('V-')?'visitor.notify':'repair.report',summary:booking?`${payload.date} ${payload.startTime} 公設 #${payload.amenityId}`:String(payload.title??'服務申請')},(user.language??'zh-TW') as 'zh-TW'|'en'|'ja'):{type:'text',text:`${booking?'預約':'工單'} #${ref} 狀態更新：${statusLabels[String(payload.status)]??payload.status}`};
    sqlite.prepare('INSERT INTO notification_deliveries(event_id,recipient,retry_key,message) VALUES(?,?,?,?)').run(event.id,user.line_user_id,retryKey(event.id,user.line_user_id),JSON.stringify(message));
   }
  }).immediate();
  const pending=sqlite.prepare('SELECT recipient,retry_key,message FROM notification_deliveries WHERE event_id=? AND delivered_at IS NULL').all(event.id) as {recipient:string;retry_key:string;message:string}[];
  for(const row of pending) {
   await client.push(row.recipient,JSON.parse(row.message),row.retry_key);
   sqlite.prepare('UPDATE notification_deliveries SET delivered_at=? WHERE event_id=? AND recipient=?').run(Date.now(),event.id,row.recipient);
  }
 };
}
