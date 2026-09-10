import {it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import type {TrpcContext} from '../../../src/server/_core/context';
import {voiceRouter} from '../../../src/server/routers/voice';
let sqlite:Database.Database;
vi.mock('../../../src/server/database/adapter',()=>({dbManager:{getType:()=> 'sqlite',getRawSqlite:()=>sqlite}}));
vi.mock('../../../src/server/db',()=>({
 getAllAmenities:async()=>[{id:1,name:'gym',isActive:true}],
 getAmenityById:async()=>({id:1,name:'gym',isActive:true,capacity:1,openTime:'08:00',closeTime:'22:00',slotDurationMinutes:60}),
 getBookingsByAmenityAndDate:async()=>sqlite.prepare('SELECT * FROM bookings').all(),
 getUserById:async()=>({id:1,role:'resident'}),
}));
it('voice retries return the original booking when it occupies the last place',async()=>{
 sqlite=new Database(':memory:');
 sqlite.exec(`CREATE TABLE amenities(id INTEGER PRIMARY KEY,capacity INTEGER,isActive INTEGER,openTime TEXT,closeTime TEXT,slotDurationMinutes INTEGER); INSERT INTO amenities VALUES(1,1,1,'08:00','22:00',60); CREATE TABLE bookings(id INTEGER PRIMARY KEY,userId INTEGER,amenityId INTEGER,date TEXT,startTime TEXT,endTime TEXT,guestCount INTEGER,notes TEXT,status TEXT DEFAULT 'confirmed');`);
 sqlite.exec(readFileSync('migrations/sqlite/0018_booking_requests.sql','utf8'));
 try {
  const caller=voiceRouter.createCaller({user:{id:1,role:'resident'}} as TrpcContext);
  const input={intent:'facility.book' as const,slots:{facility:'gym' as const,date:'2099-01-01',time:'10:00',duration_min:60},requestId:'voice-1'};
  expect(await caller.commit(input)).toEqual({ref:'BK-1'});
  expect(await caller.commit(input)).toEqual({ref:'BK-1'});
  await expect(caller.commit({...input,requestId:'voice-2'})).rejects.toMatchObject({code:'CONFLICT'});
  expect(sqlite.prepare('SELECT count(*) AS n FROM bookings').get()).toEqual({n:1});
  const staff=voiceRouter.createCaller({user:{id:2,role:'admin'}} as TrpcContext);
  await expect(staff.commit(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(caller.staffCommit({...input,targetUserId:1})).rejects.toMatchObject({code:'FORBIDDEN'});
 }finally{sqlite.close();}
});
