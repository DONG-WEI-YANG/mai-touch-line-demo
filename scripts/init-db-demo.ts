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

  // Seed amenities (id=1..6) so bookings.amenityId FK constraint passes for the
  // 6 facility types our LINE bot recognizes (gym/pool/meeting_room/lounge/bbq/sauna).
  // Without this, bookFn throws SqliteError: FOREIGN KEY constraint failed at the
  // EXECUTING step of the booking flow.
  const amenities = [
    [1, 'gym',          'recreation',    'fitness',  20, 'Floor 12 — gym'],
    [2, 'pool',         'wellness',      'pool',     30, 'Floor 1 — pool'],
    [3, 'meeting_room', 'business',      'briefcase', 8, 'Floor 5 — meeting room'],
    [4, 'lounge',       'recreation',    'sofa',     40, 'Floor 1 — lounge'],
    [5, 'bbq',          'outdoor',       'flame',    20, 'Rooftop — BBQ area'],
    [6, 'sauna',        'wellness',      'flame',    10, 'Floor 12 — sauna'],
  ] as const;
  const insAmenity = sqliteDb.prepare(`
    INSERT OR IGNORE INTO amenities
      (id, name, description, icon, category, capacity, location, openTime, closeTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, '08:00', '22:00')
  `);
  for (const [id, name, category, icon, capacity, location] of amenities) {
    insAmenity.run(id, name, `${name} amenity (demo)`, icon, category, capacity, location);
  }

  sqliteDb.close();

  console.log('[demo-init] seeded 2 base users + 6 amenities (idempotent)');
  console.log('[demo-init] done');
  process.exit(0);
}

main().catch(err => {
  console.error('[demo-init] FAILED', err);
  process.exit(1);
});
