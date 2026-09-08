import Database from 'better-sqlite3';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeRecordLinks } from '../../src/server/line/record-links';
import { makeRecordQuery } from '../../src/server/line/record-query';
let db: Database.Database;
let repo: ReturnType<typeof makeRecordLinks>;
const resident = { userId: 1, staff: false, lineUserId: 'U1' };
const staff = { userId: 3, staff: true, lineUserId: 'U3' };
beforeEach(() => {
  db = new Database(':memory:');
  db.exec(fs.readFileSync('migrations/sqlite/0001_initial_schema.sql', 'utf8'));
  db.exec(fs.readFileSync('migrations/sqlite/0013_parking.sql', 'utf8'));
  db.exec(fs.readFileSync('migrations/sqlite/0016_line_record_links.sql', 'utf8'));
  db.exec(`INSERT INTO users(id,openId,name) VALUES (1,'u1','one'),(2,'u2','two');
    INSERT INTO amenities(id,name) VALUES(1,'泳池');
    INSERT INTO bookings(id,userId,amenityId,date,startTime,endTime) VALUES(1,1,1,'2026-09-12','18:00','19:00'),(2,2,1,'2026-09-12','19:00','20:00');
    INSERT INTO work_orders(id,userId,title,description) VALUES(1,1,'[visitor] guest','{"visitor_name":"陳先生","date":"2026-09-12"}'),(2,2,'[visitor] other','{}'),(3,1,'repair','{}');
    INSERT INTO parking_spots(id,label) VALUES(1,'A1');
    INSERT INTO parking_assignments(id,spot_id,user_id,vehicle_plate) VALUES(1,1,1,'ABC-1234'),(2,1,2,'XYZ-9999');`);
  repo = makeRecordLinks(db);
});
afterEach(() => db.close());
describe('linked records', () => {
  it('links booking, visitor and plate bidirectionally with audit', () => {
    repo.link(['BK-1','V-1','P-1'], resident);
    expect(repo.related('P-1',resident).map(r=>r.ref).sort()).toEqual(['BK-1','P-1','V-1']);
    expect((db.prepare('SELECT created_by FROM line_record_links LIMIT 1').get() as any).created_by).toBe('U1');
    repo.link(['P-1','BK-1'],resident);
    expect((db.prepare('SELECT COUNT(*) n FROM line_record_links').get() as any).n).toBe(2);
  });
  it('blocks other residents and cross-owner links even for staff, without partial writes', () => {
    expect(()=>repo.related('BK-2',resident)).toThrow();
    expect(()=>repo.link(['BK-1','V-2'],resident)).toThrow();
    expect(()=>repo.link(['BK-1','V-1','P-2'],staff)).toThrow();
    expect((db.prepare('SELECT COUNT(*) n FROM line_record_links').get() as any).n).toBe(0);
    expect(repo.list('BK',staff)).toHaveLength(2);
    expect(repo.list('BK',resident)).toHaveLength(1);
  });
  it('does not interpret repair orders as visitor records', () => {
    expect(()=>repo.related('V-3',resident)).toThrow();
  });
  it('plate lookup returns linked records without exposing another owner', async () => {
    repo.link(['BK-1','V-1','P-1'],resident);
    const query=makeRecordQuery({ records:repo, actor:()=>resident, resolveAmenityId:async()=>1 });
    expect(await query('查詢車號 ABC-1234','U1')).toContain('BK-1');
    expect(await query('查詢車號 XYZ-9999','U1')).toBe('查無紀錄');
    expect(await query('查詢訪客','U1')).toContain('陳先生');
  });
});
