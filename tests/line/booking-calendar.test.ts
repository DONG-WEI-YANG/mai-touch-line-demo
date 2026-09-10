import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import { makeBookingCalendar, calendarMessage } from '../../src/server/line/booking-calendar';
const db = new Database(':memory:');
db.exec(`CREATE TABLE bookings(id INTEGER,userId INTEGER,amenityId INTEGER,date TEXT,startTime TEXT,endTime TEXT,status TEXT);
CREATE TABLE amenities(id INTEGER,name TEXT);
INSERT INTO amenities VALUES(1,'泳池');
INSERT INTO bookings VALUES(1,1,1,'2024-02-29','10:00','11:00','cancelled'),(2,2,1,'2024-02-29','11:00','12:00','confirmed');`);
afterEach(()=>db.exec('DELETE FROM bookings WHERE id>2'));
it('uses owner-scoped month counts and preserves cancelled history',()=>{
  const read=makeBookingCalendar(db,()=>1);
  expect(read('U1','2024-02').counts).toEqual({'2024-02-29':1});
  const day=read('U1','2024-02','2024-02-29');
  expect(day.bookings.map(b=>b.id)).toEqual([1]);
  expect(day.bookings[0].status).toBe('cancelled');
});
it('paginates full history beyond the old 20-record list limit',()=>{
  const insert=db.prepare("INSERT INTO bookings VALUES(?,1,1,'2024-02-29','12:00','13:00','completed')");
  for(let id=3;id<=27;id++) insert.run(id);
  const read=makeBookingCalendar(db,()=>1);
  expect(read('U1','2024-02').counts['2024-02-29']).toBe(26);
  expect(read('U1','2024-02','2024-02-29',20).bookings).toHaveLength(6);
});
it('rejects invalid months, dates, mismatched months and missing account identity',()=>{
  const read=makeBookingCalendar(db,()=>1);
  expect(()=>read('U1','2024-13')).toThrow();
  expect(()=>read('U1','2023-02','2023-02-29')).toThrow();
  expect(()=>read('U1','2024-02','2024-03-01')).toThrow();
  expect(()=>makeBookingCalendar(db,()=>0)('U1','2024-02')).toThrow();
});
it('renders leap day, month navigation and both LINE and Web choices',()=>{
  const data=makeBookingCalendar(db,()=>1)('U1','2024-02','2024-02-29');
  const json=JSON.stringify(calendarMessage(data,'https://example.com/personal'));
  expect(json).toContain('day=2024-02-29');
  expect(json).toContain('month=2024-01');
  expect(json).toContain('month=2024-03');
  expect(json).toContain('https://example.com/personal');
  expect(json).toContain('已取消');
  expect(json).not.toContain('BK-2');
});
