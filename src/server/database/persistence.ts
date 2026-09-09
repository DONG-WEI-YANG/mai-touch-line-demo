import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { setInterval, clearInterval } from 'node:timers';

export function assertPersistentStorage(filename: string, root: string, mountInfo?: string): void {
  if (!path.isAbsolute(root) || !path.isAbsolute(filename)) throw new Error('Persistent database paths must be absolute');
  const realRoot = fs.realpathSync(root); // Never create a missing mount directory.
  const parent = fs.realpathSync(path.dirname(filename));
  const relative = path.relative(realRoot, path.join(parent, path.basename(filename)));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Database must be inside the persistent disk');
  if (fs.existsSync(filename) && fs.lstatSync(filename).isSymbolicLink()) throw new Error('Database cannot be a symbolic link');
  if (mountInfo !== undefined) {
    const mounts = mountInfo.split('\n').map(line => line.split(' ')[4]?.replace(/\\040/g, ' '));
    if (!mounts.includes(realRoot)) throw new Error('Persistent disk is not mounted; refusing ephemeral storage');
  }
  fs.accessSync(realRoot, fs.constants.R_OK | fs.constants.W_OK);
}

export function verifySnapshot(filename: string): void {
  const source = new Database(filename, { readonly:true, fileMustExist:true });
  try {
    if (source.pragma('integrity_check', { simple:true }) !== 'ok') throw new Error('SQLite integrity check failed');
    if ((source.pragma('foreign_key_check') as unknown[]).length) throw new Error('SQLite foreign key check failed');
  } finally { source.close(); }
}

function sealSnapshot(filename: string): void {
  const snapshot=new Database(filename,{fileMustExist:true});
  try { snapshot.pragma('journal_mode = DELETE'); }
  finally { snapshot.close(); }
  verifySnapshot(filename);
}

export async function backupDatabase(db: Database.Database, directory: string): Promise<string> {
  fs.mkdirSync(directory, { recursive:true, mode:0o700 });
  const target = path.join(directory, `mai-touch-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID()}.db`);
  const temporary = target + '.partial';
  try {
    await db.backup(temporary);
    fs.chmodSync(temporary,0o600);
    sealSnapshot(temporary);
    fs.renameSync(temporary,target);
    return target;
  } catch (err) {
    fs.rmSync(temporary,{force:true});
    throw err;
  }
}

export function pruneBackups(directory: string, keep = 14): void {
  if (!Number.isInteger(keep) || keep < 1) throw new Error('Backup retention must be positive');
  const files = fs.readdirSync(directory).filter(name => /^mai-touch-\d{4}-.*-[0-9a-f-]{36}\.db$/.test(name))
    .filter(name => fs.lstatSync(path.join(directory,name)).isFile()).sort().reverse();
  for (const file of files.slice(keep)) fs.unlinkSync(path.join(directory,file));
}

/** Restore to a NEW file only. Switch the stopped service to it after verification. */
export async function restoreDatabase(sourceFile: string, target: string): Promise<void> {
  verifySnapshot(sourceFile);
  if ([target,target+'-wal',target+'-shm'].some(file => fs.existsSync(file))) throw new Error('Restore target already exists; refusing overwrite');
  fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
  const temporary=target+'.restore-'+crypto.randomUUID();
  const source=new Database(sourceFile,{readonly:true,fileMustExist:true});
  try {
    await source.backup(temporary);
    fs.chmodSync(temporary,0o600);
    sealSnapshot(temporary);
    fs.linkSync(temporary,target); // Atomic publication that cannot overwrite a raced destination.
  } finally {
    source.close();
    fs.rmSync(temporary,{force:true});
  }
}

export function startBackupScheduler(db: Database.Database, directory: string) {
  let running=false;
  const run=async()=>{
    if (running) return;
    running=true;
    try { await backupDatabase(db,directory); pruneBackups(directory); console.log('[backup] verified snapshot created'); }
    catch { console.error('[backup] snapshot failed; previous backups retained'); }
    finally { running=false; }
  };
  void run();
  const timer=setInterval(()=>void run(),24*60*60*1000);
  (timer as unknown as { unref?: () => void }).unref?.();
  return ()=>clearInterval(timer);
}

export function persistentMountInfo(): string | undefined {
  const requireMount = process.env.RENDER === 'true' || process.env.REQUIRE_PERSISTENT_STORAGE === '1';
  return requireMount && os.platform()==='linux' ? fs.readFileSync('/proc/self/mountinfo','utf8') : undefined;
}
