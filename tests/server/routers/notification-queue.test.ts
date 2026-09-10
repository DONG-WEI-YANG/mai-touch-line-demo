import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {appRouter} from '../../../src/server/routers';
import {dbManager} from '../../../src/server/database/adapter';
import type {TrpcContext} from '../../../src/server/_core/context';
let sqlite:Database.Database;
beforeEach(()=>{
 sqlite=new Database(':memory:');
 sqlite.exec(`CREATE TABLE notification_outbox(id TEXT,delivered_at INTEGER,last_error TEXT,payload TEXT);
 INSERT INTO notification_outbox VALUES('pending',NULL,NULL,'resident-private-message'),('failed',NULL,'DELIVERY_FAILED','private-phone-number'),('delivered',1234,NULL,'private-address');`);
 vi.spyOn(dbManager,'getType').mockReturnValue('sqlite');
 vi.spyOn(dbManager,'getRawSqlite').mockReturnValue(sqlite);
});
afterEach(()=>{vi.restoreAllMocks();sqlite.close();});
const caller=(role:string|null)=>appRouter.createCaller({user:role?{id:1,role}:null} as TrpcContext);
describe('notification queue administration',()=>{
 it('returns only aggregate pending and failure counts to admins and excludes delivered events',async()=>{
  const result=await caller('admin').system.notificationQueue();
  expect(result).toEqual({configured:true,pending:2,failed:1});
  expect(JSON.stringify(result)).not.toMatch(/private|payload|DELIVERY_FAILED|pending.*id/);
  sqlite.prepare('DELETE FROM notification_outbox').run();
  expect(await caller('admin').system.notificationQueue()).toEqual({configured:true,pending:0,failed:0});
 });
 it.each(['resident','logistics',null])('rejects %s before accessing queue data',async(role)=>{
  await expect(caller(role).system.notificationQueue()).rejects.toMatchObject({code:role?'FORBIDDEN':'UNAUTHORIZED'});
  expect(dbManager.getRawSqlite).not.toHaveBeenCalled();
 });
 it('reports unconfigured on unsupported database without reading SQLite',async()=>{
  vi.mocked(dbManager.getType).mockReturnValue('postgres');
  expect(await caller('admin').system.notificationQueue()).toEqual({configured:false,pending:0,failed:0});
  expect(dbManager.getRawSqlite).not.toHaveBeenCalled();
 });
});
