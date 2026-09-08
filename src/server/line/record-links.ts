import type Database from 'better-sqlite3';

export type RecordActor = { userId: number; staff: boolean; lineUserId: string };
export type LinkedRecord = { ref: string; userId: number | null; detail: string };
const REF = /^(BK|V|P|WO)-(\d+)$/;

export function makeRecordLinks(db: Database.Database) {
  function record(ref: string): LinkedRecord | undefined {
    const match = REF.exec(ref);
    if (!match) return;
    const id = Number(match[2]);
    if (match[1] === 'BK') {
      const r = db.prepare('SELECT b.*, a.name AS facilityName FROM bookings b LEFT JOIN amenities a ON a.id=b.amenityId WHERE b.id=?').get(id) as any;
      if (r) return { ref, userId: r.userId, detail: `${r.facilityName ?? '設施'} ${r.date} ${r.startTime}–${r.endTime} ${r.status}` };
    } else if (match[1] === 'V' || match[1] === 'WO') {
      const r = db.prepare("SELECT * FROM work_orders WHERE id=?").get(id) as any;
      if (match[1] === 'V' && !r?.title?.startsWith('[visitor] ')) return;
      if (match[1] === 'WO' && r?.title?.startsWith('[visitor] ')) return;
      if (r) {
        if (match[1] === 'WO') return { ref, userId:r.userId, detail:`${r.title} ${r.status}` };
        let s: any = {};
        try { s = JSON.parse(r.description); } catch { /* legacy description */ }
        return { ref, userId: r.userId, detail: `訪客 ${s.visitor_name ?? ''} ${s.visitor_count ?? ''}人 ${s.date ?? ''} ${s.time ?? ''} ${r.status}` };
      }
    } else {
      const r = db.prepare('SELECT a.*, s.label FROM parking_assignments a LEFT JOIN parking_spots s ON s.id=a.spot_id WHERE a.id=?').get(id) as any;
      if (r) return { ref, userId: r.user_id, detail: `車號 ${r.vehicle_plate} 車位 ${r.label ?? ''} ${r.driver_name ?? ''} ${r.start_at} ${r.end_at ? `結束 ${r.end_at}` : '使用中'}` };
    }
  }
  function allowed(r: LinkedRecord | undefined, actor: RecordActor): r is LinkedRecord {
    return !!r && (actor.staff || r.userId === actor.userId);
  }
  function related(ref: string, actor: RecordActor): LinkedRecord[] {
    if (!allowed(record(ref), actor)) throw new Error('找不到紀錄或無查詢權限');
    const visited = new Set<string>();
    const pending = [ref];
    const result: LinkedRecord[] = [];
    while (pending.length && visited.size < 100) {
      const current = pending.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const r = record(current);
      if (!allowed(r, actor)) continue;
      result.push(r);
      const edges = db.prepare('SELECT source_ref, target_ref FROM line_record_links WHERE source_ref=? OR target_ref=?').all(current, current) as any[];
      for (const edge of edges) pending.push(edge.source_ref === current ? edge.target_ref : edge.source_ref);
    }
    return result;
  }
  const link = db.transaction((refs: string[], actor: RecordActor) => {
    const unique = [...new Set(refs)];
    if (unique.length < 2 || unique.length > 10) throw new Error('請指定 2 至 10 個不同單號');
    const rows = unique.map(record);
    if (rows.some(r => !allowed(r, actor))) throw new Error('找不到紀錄或無關聯權限');
    if (rows[0]!.userId == null || rows.some(r => r!.userId !== rows[0]!.userId)) throw new Error('僅能關聯同一住戶的紀錄');
    const insert = db.prepare('INSERT OR IGNORE INTO line_record_links(source_ref,target_ref,created_by) VALUES (?,?,?)');
    for (const target of unique.slice(1)) {
      const pair = [unique[0], target].sort();
      insert.run(pair[0], pair[1], actor.lineUserId);
    }
    return related(unique[0], actor);
  });
  function list(kind: 'BK' | 'V' | 'P' | 'WO', actor: RecordActor, plate?: string): LinkedRecord[] {
    const table = kind === 'BK' ? 'bookings' : (kind === 'V' || kind === 'WO') ? 'work_orders' : 'parking_assignments';
    const owner = kind === 'P' ? 'user_id' : 'userId';
    const clauses: string[] = [];
    const values: (string | number)[] = [];
    if (!actor.staff) { clauses.push(`${owner}=?`); values.push(actor.userId); }
    if (kind === 'V') clauses.push("title LIKE '[visitor] %'");
    if (kind === 'WO') clauses.push("title NOT LIKE '[visitor] %'");
    if (plate) { clauses.push('UPPER(vehicle_plate)=?'); values.push(plate.toUpperCase()); }
    const rows = db.prepare(`SELECT id FROM ${table}${clauses.length ? ' WHERE ' + clauses.join(' AND ') : ''} ORDER BY id DESC LIMIT 20`).all(...values) as { id: number }[];
    return rows.map(r => record(`${kind}-${r.id}`)).filter((r): r is LinkedRecord => !!r);
  }
  return { related, link, list };
}

