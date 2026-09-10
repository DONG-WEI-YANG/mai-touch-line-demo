import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { restoreDatabase, verifySnapshot } from '../src/server/database/persistence';

export async function drillRestore(snapshot: string, expectedSha256: string, newTarget: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new Error('Invalid SHA256');
  if (path.resolve(snapshot) === path.resolve(newTarget)) throw new Error('Restore destination must be new');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(snapshot)).digest('hex');
  if (actual !== expectedSha256.toLowerCase()) throw new Error('Snapshot SHA256 mismatch');
  verifySnapshot(snapshot);
  await restoreDatabase(snapshot, newTarget);
  verifySnapshot(newTarget);
  return { sha256: actual, integrity: 'ok', foreignKeys: 'ok', restored: true };
}

if (require.main === module) {
  const [snapshot, sha256, target] = process.argv.slice(2);
  if (!snapshot || !sha256 || !target) {
    console.error('Usage: tsx scripts/offsite-restore-drill.ts <downloaded.db> <expected SHA256> <NEW restored.db>');
    process.exitCode = 1;
  } else drillRestore(snapshot, sha256, target)
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error('Restore drill failed; existing destination was not overwritten'); process.exitCode = 1; });
}
