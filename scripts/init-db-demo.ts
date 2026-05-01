/**
 * Demo Database Initialization Script
 * Bootstraps the demo SQLite database with migrations and seed users.
 *
 * NOTE: The users table role CHECK constraint only allows ('resident', 'admin', 'logistics').
 * The plan specified role='user' for the seed user, but this is not a valid role in the
 * existing schema. We use 'resident' instead, which is the correct default resident role.
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { dbManager } from '../src/server/database/adapter';
import { runMigrations } from '../src/server/database/migrate';

async function main() {
  const dbPath = process.env.SQLITE_FILENAME ?? './data/mai-touch-demo.db';
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

  console.log(`[demo-init] using DB: ${dbPath}`);

  // Set SQLITE_FILENAME so that adapter.parseDatabaseConfig() picks up the demo path
  process.env.SQLITE_FILENAME = dbPath;

  const adapter = await dbManager.connect();
  console.log(`[demo-init] connected (${adapter.type})`);

  await runMigrations();
  console.log('[demo-init] migrations complete');

  // Seed minimal users via direct better-sqlite3 (idempotent via INSERT OR IGNORE)
  // Using direct sqlite because dbManager may have a Drizzle mysql adapter in non-sqlite configs.
  // For the demo profile, DB_TYPE defaults to 'sqlite', so we use better-sqlite3 directly.
  const Database = require('better-sqlite3');
  const resolvedPath = path.resolve(dbPath);
  const sqliteDb = new Database(resolvedPath);

  // id=1 seed@demo.local role='resident' (plan said 'user' but schema requires 'resident')
  sqliteDb.prepare(`
    INSERT OR IGNORE INTO users (id, openId, name, email, loginMethod, role, tier)
    VALUES (1, 'demo-seed-001', 'Demo Seed User', 'seed@demo.local', 'demo', 'resident', 'Platinum')
  `).run();

  // id=2 admin@demo.local role='admin'
  sqliteDb.prepare(`
    INSERT OR IGNORE INTO users (id, openId, name, email, loginMethod, role, tier)
    VALUES (2, 'demo-admin-001', 'Demo Admin', 'admin@demo.local', 'demo', 'admin', 'Platinum')
  `).run();

  sqliteDb.close();

  console.log('[demo-init] seeded 2 base users (idempotent)');
  console.log('[demo-init] done');
  process.exit(0);
}

main().catch(err => {
  console.error('[demo-init] FAILED', err);
  process.exit(1);
});
