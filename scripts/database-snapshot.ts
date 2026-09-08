import 'dotenv/config';
import path from 'node:path';
import Database from 'better-sqlite3';
import { backupDatabase,restoreDatabase,verifySnapshot } from '../src/server/database/persistence';
async function main() {
  const [operation,first,second]=process.argv.slice(2);
  if (operation==='verify' && first) { verifySnapshot(path.resolve(first)); console.log('Snapshot verified'); return; }
  if (operation==='restore' && first && second) { await restoreDatabase(path.resolve(first),path.resolve(second)); console.log('Restored and verified; destination was not overwritten'); return; }
  if (operation==='backup' && first && second) {
    const db=new Database(path.resolve(first),{readonly:true,fileMustExist:true});
    try { console.log(await backupDatabase(db,path.resolve(second))); } finally { db.close(); }
    return;
  }
  throw new Error('Usage: npm run db:snapshot -- backup <database> <directory> | verify <snapshot> | restore <snapshot> <NEW database>');
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});
