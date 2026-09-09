import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { assertPersistentStorage,backupDatabase,restoreDatabase,verifySnapshot,pruneBackups,persistentMountInfo } from '../../src/server/database/persistence';
let directory:string;
let db:Database.Database;
beforeEach(()=>{
  directory=fs.mkdtempSync(path.join(os.tmpdir(),'persistence-test-'));
  db=new Database(path.join(directory,'live.db'));
  db.pragma('journal_mode=WAL');
  db.exec('CREATE TABLE history(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO history VALUES(1,\'booking visitor plate link\')');
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();db.close();fs.rmSync(directory,{recursive:true,force:true});});
it('refuses an unmounted data directory on a persistent Linux host outside Render',()=>{
  vi.stubEnv('RENDER','');
  vi.stubEnv('REQUIRE_PERSISTENT_STORAGE','1');
  vi.spyOn(os,'platform').mockReturnValue('linux');
  vi.spyOn(fs,'readFileSync').mockReturnValue('');
  expect(()=>assertPersistentStorage(path.join(directory,'live.db'),directory,persistentMountInfo())).toThrow('not mounted');
});
it('backs up WAL contents and restores history after reopening',async()=>{
  const snapshot=await backupDatabase(db,path.join(directory,'backups'));
  verifySnapshot(snapshot);
  const destination=path.join(directory,'restored.db');
  await restoreDatabase(snapshot,destination);
  const restored=new Database(destination);
  expect(restored.prepare('SELECT value FROM history').pluck().get()).toBe('booking visitor plate link');
  restored.close();
  await expect(restoreDatabase(snapshot,destination)).rejects.toThrow('refusing overwrite');
});
it('rejects corrupt snapshots and leaves the target absent',async()=>{
  const broken=path.join(directory,'broken.db');
  fs.writeFileSync(broken,'not a database');
  const destination=path.join(directory,'restored.db');
  await expect(restoreDatabase(broken,destination)).rejects.toThrow();
  expect(fs.existsSync(destination)).toBe(false);
});
it('requires the configured mount and rejects paths outside it',()=>{
  const target=path.join(directory,'live.db');
  expect(()=>assertPersistentStorage(target,directory,'')).toThrow('not mounted');
  expect(()=>assertPersistentStorage(path.join(os.tmpdir(),'other.db'),directory)).toThrow('inside');
  expect(()=>assertPersistentStorage(target,directory)).not.toThrow();
});
it('prunes only its own snapshots',async()=>{
  const folder=path.join(directory,'backups');
  await backupDatabase(db,folder);
  await backupDatabase(db,folder);
  fs.writeFileSync(path.join(folder,'keep.db'),'manual backup');
  pruneBackups(folder,1);
  expect(fs.readdirSync(folder).filter(f=>/^mai-touch-/.test(f))).toHaveLength(1);
  expect(fs.existsSync(path.join(folder,'keep.db'))).toBe(true);
});
