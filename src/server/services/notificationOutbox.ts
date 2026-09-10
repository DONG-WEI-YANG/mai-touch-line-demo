import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {setInterval,clearInterval} from 'node:timers';

export interface NotificationEvent {
 id: string; kind: 'booking.created'|'booking.status'|'work_order.created'|'work_order.status';
 entity_id: number; user_id: number; payload: string; attempts: number;
}
/** Transactional claim; survives restart and excludes other workers until lease expiry.
 * Delivery is at-least-once: pass event.id as the provider idempotency key.
 */
export async function drainNotificationOutbox(sqlite: Database.Database,
 deliver: (event: NotificationEvent) => Promise<void>, now=Date.now(), limit=20) {
 const started=Date.now();
 const clock=()=>now+Date.now()-started;
 let sent=0,failed=0;
 for(let i=0;i<limit;i++) {
  const tick=clock();
  const token=randomUUID();
  const event=sqlite.transaction(()=>{
   const row=sqlite.prepare("SELECT current.* FROM notification_outbox current WHERE current.delivered_at IS NULL AND current.available_at<=? AND current.lease_until<=? AND NOT EXISTS (SELECT 1 FROM notification_outbox earlier WHERE earlier.rowid<current.rowid AND earlier.delivered_at IS NULL AND earlier.entity_id=current.entity_id AND substr(earlier.kind,1,instr(earlier.kind,'.')-1)=substr(current.kind,1,instr(current.kind,'.')-1)) ORDER BY current.rowid LIMIT 1").get(tick,tick) as NotificationEvent|undefined;
   if(!row)return undefined;
   sqlite.prepare('UPDATE notification_outbox SET lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=?').run(token,tick+120000,row.id);
   return row;
  }).immediate();
  if(!event)break;
  const heartbeat=setInterval(()=>{
   try {sqlite.prepare("UPDATE notification_outbox SET lease_until=? WHERE id=? AND lease_token=?").run(Date.now()+120000,event.id,token);} catch { /* persisted lease expires if database is unavailable */ }
  },30000);
  try {
   await deliver(event);
   sqlite.prepare('UPDATE notification_outbox SET delivered_at=?,lease_until=0,lease_token=NULL,last_error=NULL WHERE id=? AND lease_token=?').run(Date.now(),event.id,token);
   sent++;
  } catch {
   // Never persist provider bodies, bearer tokens or resident message contents.
   const delay=Math.min(3600000,1000*2**Math.min(event.attempts,12));
   sqlite.prepare("UPDATE notification_outbox SET available_at=?,lease_until=0,lease_token=NULL,last_error='DELIVERY_FAILED' WHERE id=? AND lease_token=?").run(clock()+delay,event.id,token);
   failed++;
  } finally {clearInterval(heartbeat);}
 }
 return {sent,failed};
}
export function notificationOutboxStats(sqlite:Database.Database) {
 return sqlite.prepare('SELECT count(*) AS pending, sum(CASE WHEN attempts>0 THEN 1 ELSE 0 END) AS retried, min(created_at) AS oldest FROM notification_outbox WHERE delivered_at IS NULL').get();
}
