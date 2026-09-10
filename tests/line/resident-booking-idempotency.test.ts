import {it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {handleResident,type ResidentDeps} from '../../src/server/line/handlers/resident';
import {SessionStore,SqliteSessionBackend} from '../../src/server/line/session-store';

it('persists LINE booking request ID before write, retries after restart, and renews for a new booking',async()=>{
 const db=new Database(':memory:');
 db.exec('CREATE TABLE line_sessions(user_id TEXT PRIMARY KEY,state TEXT,updated_at INTEGER)');
 const makeStore=()=>new SessionStore({backend:new SqliteSessionBackend(db)});
 let store=makeStore();
 const begin=()=>store.set('U1',{userId:'U1',role:'resident',language:'zh-TW',intent:'facility.book',step:'CONFIRMING',slots:{facility:'gym',date:'2099-01-01',time:'10:00'},missingSlots:[],updatedAt:Date.now()});
 begin();const keys:string[]=[];let fail=true;
 const deps={store,channelId:'C',lineUser:{lineUserId:'U1',role:'resident',language:'zh-TW'},ai:{classify:vi.fn()},client:{replyOrPush:vi.fn()},reportFn:vi.fn(),pushHousekeepers:vi.fn(),listMyOrders:async()=>[],bookFn:async(input:{requestId?:string})=>{
  expect(store.get('U1')?.slots.requestId).toBe(input.requestId);
  expect(store.get('U1')?.step).toBe('EXECUTING');
  keys.push(input.requestId!);if(fail)throw new Error('response lost');return {id:'BK-1'};
 }} as unknown as ResidentDeps;
 const event={type:'postback',replyToken:'r',postback:{data:'act=confirm'}};
 try {
  await handleResident(event,deps);
  store=makeStore();deps.store=store;
  // Simulate process stopped after database commit but before clearing the session.
  store.set('U1',{...store.get('U1')!,step:'EXECUTING'});
  fail=false;await handleResident(event,deps);
  expect(keys[1]).toBe(keys[0]);expect(keys[0]).toMatch(/^line:[0-9a-f-]{36}$/);
  expect(store.get('U1')?.step).toBe('IDLE');
  begin();await handleResident(event,deps);
  expect(keys[2]).not.toBe(keys[0]);
 }finally{db.close();}
});
