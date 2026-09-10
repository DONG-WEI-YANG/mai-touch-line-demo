import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { drillRestore } from '../../scripts/offsite-restore-drill';
let dir: string;
let source: string;
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-drill-'));
  source = path.join(dir, 'download.db');
  const db = new Database(source);
  db.exec('CREATE TABLE history(id INTEGER PRIMARY KEY); INSERT INTO history VALUES(7)');
  db.close();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
it('restores a verified download to a new database and preserves history', async () => {
  const target = path.join(dir, 'restore.db');
  await expect(drillRestore(source, digest(), target)).resolves.toMatchObject({ integrity: 'ok', restored: true });
  const db = new Database(target, { readonly: true });
  try { expect(db.prepare('SELECT id FROM history').get()).toEqual({ id: 7 }); } finally { db.close(); }
});
it('rejects wrong hash without creating the restore file', async () => {
  const target = path.join(dir, 'restore.db');
  await expect(drillRestore(source, '0'.repeat(64), target)).rejects.toThrow('SHA256');
  expect(fs.existsSync(target)).toBe(false);
});
it('never overwrites an existing destination', async () => {
  const target = path.join(dir, 'restore.db');
  fs.writeFileSync(target, 'existing');
  await expect(drillRestore(source, digest(), target)).rejects.toThrow('already exists');
  expect(fs.readFileSync(target, 'utf8')).toBe('existing');
});
it('rejects foreign key corruption despite a correct content hash', async () => {
  const db = new Database(source);
  db.pragma('foreign_keys=OFF');
  db.exec('CREATE TABLE child(parent INTEGER REFERENCES history(id)); INSERT INTO child VALUES(999)');
  db.close();
  await expect(drillRestore(source, digest(), path.join(dir, 'restore.db'))).rejects.toThrow('foreign key');
});
