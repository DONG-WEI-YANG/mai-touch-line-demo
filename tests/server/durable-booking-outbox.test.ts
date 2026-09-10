import { describe,it,expect } from 'vitest';
import Database from 'better-sqlite3';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createSqliteBooking} from '../../src/server/services/sqliteBooking';
import {makeOutboxDelivery} from '../../src/server/services/outboxDelivery';
import {drainNotificationOutbox} from '../../src/server/services/notificationOutbox';
function setup(path=':memory:') {
 const d=new Database(path);d.pragma('foreign_keys = ON');
 d.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT); INSERT INTO users VALUES(1,'Test Resident'); CREATE TABLE line_user(line_user_id TEXT,channel_id TEXT,app_user_id INTEGER,role TEXT,language TEXT); CREATE TABLE amenities(id INTEGER PRIMARY KEY,capacity INTEGER,isActive INTEGER,openTime TEXT,closeTime TEXT,slotDurationMinutes INTEGER); INSERT INTO amenities VALUES(1,1,1,'08:00','22:00',60);
 CREATE TABLE bookings(id INTEGER PRIMARY KEY,userId INTEGER,amenityId INTEGER,date TEXT,startTime TEXT,endTime TEXT,guestCount INTEGER,notes TEXT,status TEXT DEFAULT 'confirmed');
 CREATE TABLE work_orders(id INTEGER PRIMARY KEY,userId INTEGER,status TEXT,title TEXT,description TEXT,category TEXT);`);
 for(const f of ['0018_booking_requests.sql','0019_notification_outbox.sql'])d.exec(readFileSync(join(process.cwd(),'migrations/sqlite',f),'utf8'));
 return d;
}
const input={userId:1,amenityId:1,date:'2099-01-01',startTime:'10:00',endTime:'11:00',guestCount:1,requestId:'request-one'};
describe('durable booking and notifications',()=>{
 it('returns same booking on retry and rejects changed payload without duplicating notification',()=>{
  const d=setup();try {
   const id=createSqliteBooking(d,input);expect(createSqliteBooking(d,input)).toBe(id);
   expect(()=>createSqliteBooking(d,{...input,startTime:'11:00',endTime:'12:00'})).toThrow('不同預約');
   expect(d.prepare('SELECT count(*) AS n FROM bookings').get()).toEqual({n:1});
   expect(d.prepare('SELECT count(*) AS n FROM notification_outbox').get()).toEqual({n:1});
  }finally{d.close();}
 });
 it('rolls back outbox with mutation and suppresses no-op status events',()=>{
  const d=setup();try {
   createSqliteBooking(d,input);
   expect(()=>d.transaction(()=>{d.prepare("UPDATE bookings SET status='cancelled'").run();throw new Error('abort');})()).toThrow('abort');
   d.prepare("UPDATE bookings SET status='confirmed'").run();
   expect(d.prepare('SELECT count(*) AS n FROM notification_outbox').get()).toEqual({n:1});
   d.prepare("UPDATE bookings SET status='cancelled'").run();
   expect(d.prepare('SELECT count(*) AS n FROM notification_outbox').get()).toEqual({n:2});
  }finally{d.close();}
 });
 it('persists retry after reopening database, claims once across workers, and sanitizes failures',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'outbox-'));const path=join(dir,'db.sqlite');let d=setup(path);
  try {
   createSqliteBooking(d,input);const now=Date.now()+1000;
   expect(await drainNotificationOutbox(d,async()=>{throw new Error('secret-token');},now)).toEqual({sent:0,failed:1});
   d.close();d=new Database(path);
   expect(d.prepare('SELECT last_error FROM notification_outbox').get()).toEqual({last_error:'DELIVERY_FAILED'});
   let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
   const first=drainNotificationOutbox(d,async()=>gate,now+2000);
   expect(await drainNotificationOutbox(d,async()=>{throw new Error('must not execute');},now+2000)).toEqual({sent:0,failed:0});
   release();expect(await first).toEqual({sent:1,failed:0});
   expect(await drainNotificationOutbox(d,async()=>{},now+200000)).toEqual({sent:0,failed:0});
  }finally{d.close();rmSync(dir,{recursive:true,force:true});}
 });
 it('retries only failed fan-out recipient with stable provider retry key',async()=>{
  const d=setup();try {
   d.exec("INSERT INTO line_user VALUES('hk1','channel',NULL,'housekeeper','zh-TW'),('hk2','channel',NULL,'housekeeper','zh-TW')");
   createSqliteBooking(d,input);
   const calls:{id:string;key?:string}[]=[];let fail=true;
   const delivery=makeOutboxDelivery(d,'channel',{push:async(id,_message,key)=>{calls.push({id,key});if(id==='hk2'&&fail)throw new Error('network');}});
   const now=Date.now()+1000;
   expect(await drainNotificationOutbox(d,delivery,now)).toEqual({sent:0,failed:1});
   fail=false;expect(await drainNotificationOutbox(d,delivery,now+2000)).toEqual({sent:1,failed:0});
   expect(calls.map(c=>c.id)).toEqual(['hk1','hk2','hk2']);
   expect(calls[1].key).toBe(calls[2].key);expect(calls[0].key).not.toBe(calls[1].key);
   expect(calls[0].key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  }finally{d.close();}
 });
 it('uses peak simultaneous occupancy for a booking spanning adjacent reservations',()=>{
  const d=setup();try {
   d.prepare('UPDATE amenities SET capacity=2').run();
   createSqliteBooking(d,input);
   createSqliteBooking(d,{...input,requestId:'adjacent',startTime:'11:00',endTime:'12:00'});
   expect(()=>createSqliteBooking(d,{...input,requestId:'spanning',endTime:'12:00'})).not.toThrow();
   expect(()=>d.prepare("INSERT INTO bookings(userId,amenityId,date,startTime,endTime,guestCount) VALUES(1,1,'2099-01-01','10:30','11:30',1)").run()).toThrow('capacity exceeded');
  }finally{d.close();}
 });
 it('does not deliver newer entity status ahead of a failed older event',async()=>{
  const d=setup();try {
   createSqliteBooking(d,input);d.prepare("UPDATE bookings SET status='cancelled'").run();
   const calls:string[]=[];let fail=true;
   const delivery=async(event:{kind:string})=>{calls.push(event.kind);if(fail)throw new Error('offline');};
   const now=Date.now()+1000;
   expect(await drainNotificationOutbox(d,delivery,now)).toEqual({sent:0,failed:1});
   expect(calls).toEqual(['booking.created']);
   fail=false;expect(await drainNotificationOutbox(d,delivery,now+2000)).toEqual({sent:2,failed:0});
   expect(calls).toEqual(['booking.created','booking.created','booking.status']);
  }finally{d.close();}
 });
 it('guards capacity across simultaneous independent Node processes, including reconfirmation',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'capacity-'));const path=join(dir,'db.sqlite');const d=setup(path);d.close();
  try {
   const code=`const D=require('better-sqlite3');const d=new D(process.argv[1]);d.pragma('busy_timeout=10000');try{d.prepare("INSERT INTO bookings(userId,amenityId,date,startTime,endTime,guestCount) VALUES(1,1,'2099-01-01','10:00','11:00',1)").run();process.stdout.write('ok')}catch(e){process.stdout.write(e.message)}finally{d.close()}`;
   const results=await Promise.all([1,2].map(()=>promisify(execFile)(process.execPath,['-e',code,path],{cwd:process.cwd()})));
   expect(results.filter(r=>r.stdout==='ok')).toHaveLength(1);
   expect(results.filter(r=>r.stdout.includes('capacity exceeded'))).toHaveLength(1);
   const check=new Database(path);try {
    check.prepare("INSERT INTO bookings(userId,amenityId,date,startTime,endTime,guestCount,status) VALUES(1,1,'2099-01-01','10:00','11:00',1,'cancelled')").run();
    expect(()=>check.prepare("UPDATE bookings SET status='confirmed' WHERE status='cancelled'").run()).toThrow('capacity exceeded');
   }finally{check.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
