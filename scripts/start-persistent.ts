import 'dotenv/config';
import fs from 'node:fs';
import { assertPersistentStorage,persistentMountInfo,restoreDatabase,verifySnapshot } from '../src/server/database/persistence';
async function main() {
  process.env.REQUIRE_PERSISTENT_STORAGE='1';
  const filename=process.env.SQLITE_FILENAME;
  const root=process.env.PERSISTENT_DATA_DIR;
  if (!filename || !root) throw new Error('SQLITE_FILENAME and PERSISTENT_DATA_DIR are required');
  assertPersistentStorage(filename,root,persistentMountInfo());
  if (!fs.existsSync(filename)) {
    const source=process.env.SQLITE_RESTORE_SOURCE;
    if (!source) throw new Error('Persistent database missing. Restore a verified snapshot first; refusing to create an empty history.');
    await restoreDatabase(source,filename);
  }
  verifySnapshot(filename);
  await import('../src/server/index');
}
main().catch(err=>{console.error('[persistent-start]',err.message);process.exitCode=1;});
