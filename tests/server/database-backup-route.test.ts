import express from 'express';
import { createServer, type Server } from 'node:http';
import Database from 'better-sqlite3';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { adminRouter } from '../../src/server/admin';
import { dbManager } from '../../src/server/database/adapter';
let server:Server;
let db:Database.Database;
let base:string;
beforeEach(async()=>{
  vi.stubEnv('ADMIN_DASHBOARD_TOKEN','test-snapshot-admin');
  db=new Database(':memory:');
  db.exec('CREATE TABLE history(id INTEGER PRIMARY KEY); INSERT INTO history VALUES(1)');
  vi.spyOn(dbManager,'getRawSqlite').mockReturnValue(db);
  const app=express();app.use('/admin',adminRouter);
  server=createServer(app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async()=>{
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  db.close();vi.restoreAllMocks();vi.unstubAllEnvs();
});
it('requires header authorization and rejects query tokens',async()=>{
  expect((await fetch(base+'/admin/database/backup?token=test-snapshot-admin')).status).toBe(401);
  expect(dbManager.getRawSqlite).not.toHaveBeenCalled();
});
it('downloads a verified binary snapshot without caching',async()=>{
  const response=await fetch(base+'/admin/database/backup',{headers:{Authorization:'Bearer test-snapshot-admin'}});
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const bytes=Buffer.from(await response.arrayBuffer());
  expect(bytes.subarray(0,15).toString()).toBe('SQLite format 3');
  const restored=new Database(bytes);
  expect(restored.prepare('SELECT COUNT(*) FROM history').pluck().get()).toBe(1);
  restored.close();
});
