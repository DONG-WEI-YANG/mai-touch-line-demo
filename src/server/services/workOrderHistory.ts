import type Database from 'better-sqlite3';
import { TRPCError } from '@trpc/server';

/** Serialize the reference check and delete against concurrent link creation. */
export function deleteUnlinkedWorkOrder(db: Database.Database, id: number) {
  db.transaction(() => {
    const refs = [`WO-${id}`, `V-${id}`];
    const linked = db.prepare(`SELECT 1 FROM line_record_links
      WHERE source_ref IN (?,?) OR target_ref IN (?,?) LIMIT 1`).get(...refs, ...refs);
    if (linked) throw new TRPCError({ code: 'CONFLICT', message: '此工單已有關聯歷史，請關閉工單以保留紀錄，不能刪除。' });
    db.prepare('DELETE FROM work_orders WHERE id=?').run(id);
  }).immediate();
}
