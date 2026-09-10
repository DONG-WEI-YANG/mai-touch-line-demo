import type Database from 'better-sqlite3';
/** Single-worker startup only. Interrupted commands are never replayed automatically. */
export function recoverInterruptedJobs(db: Database.Database): number {
  return db.prepare(`UPDATE system_jobs SET status='failed', currentStep='Simulation interrupted by server restart; device state is unconfirmed. Start a new request if needed.' WHERE status IN ('pending','running')`).run().changes;
}
