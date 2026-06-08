-- System Jobs table (recovery migration)
--
-- system_jobs was originally declared inside 0001_initial_schema.sql. Databases
-- that recorded 0001 as applied before that table existed never received it,
-- and the server does not run migrations at boot — so the table only appeared
-- via the lazy self-heal in src/server/db.ts (ensureSystemJobsTable).
--
-- This migration recreates it through the normal migration path so the schema
-- no longer depends on a runtime catch-and-create. CREATE TABLE IF NOT EXISTS
-- keeps it a no-op on databases that already have the table (fresh installs
-- from 0001, or DBs already self-healed at runtime).
CREATE TABLE IF NOT EXISTS system_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  currentStep TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
