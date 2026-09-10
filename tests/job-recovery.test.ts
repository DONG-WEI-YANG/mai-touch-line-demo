import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { recoverInterruptedJobs } from '../src/server/services/jobRecovery';
describe('job reboot recovery', () => {
 it('marks only unfinished jobs failed and never replays device writes', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE system_jobs(id INTEGER,status TEXT,progress INTEGER,currentStep TEXT); INSERT INTO system_jobs VALUES(1,'running',40,'x'),(2,'pending',0,'x'),(3,'completed',100,'done');`);
  expect(recoverInterruptedJobs(db)).toBe(2);
  expect(db.prepare('SELECT status FROM system_jobs ORDER BY id').all()).toEqual([{status:'failed'},{status:'failed'},{status:'completed'}]);
  expect(recoverInterruptedJobs(db)).toBe(0); db.close();
 });
});
