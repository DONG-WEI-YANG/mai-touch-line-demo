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

  // id=3 logistics@demo.local role='logistics' (for Vercel web logistics-dashboard demo)
  // Required for token-auth synthetic logistics user (WEB_LOGISTICS_TOKEN → users.id=3).
  sqliteDb.prepare(`
    INSERT OR IGNORE INTO users (id, openId, name, email, loginMethod, role, tier)
    VALUES (3, 'demo-logistics-001', 'Demo Logistics', 'logistics@demo.local', 'demo', 'logistics', 'Platinum')
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

  // Seed work orders so /logistics-dashboard isn't empty during demos.
  // userId=1 (resident) — they're the requester; logistics user views the list.
  // INSERT OR IGNORE on fixed ids 1..5 keeps the seed idempotent across redeploys.
  const workOrders = [
    [1, 1, '冷氣不冷', '主臥室冷氣運轉但出風不冷,可能需要補充冷媒。', 'maintenance', 'high',   'open'],
    [2, 1, '門禁卡失效', '住戶感應卡刷不過 B1 停車場閘門,煩請補卡。',           'security',     'medium', 'in_progress'],
    [3, 1, '更換燈泡',   '客廳吊燈中央燈泡燒掉一顆,煩請更換。',                  'maintenance', 'low',    'open'],
    [4, 1, '訪客接待',   '週六晚上 19:00 共 6 位訪客來訪 BBQ 區,請協助引導。',  'concierge',   'medium', 'open'],
    [5, 1, '清潔加強',   '近期梯廳味道明顯,煩請加強消毒。',                      'housekeeping','low',    'resolved'],
  ] as const;
  const insWo = sqliteDb.prepare(`
    INSERT OR IGNORE INTO work_orders
      (id, userId, title, description, category, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of workOrders) insWo.run(...row);

  sqliteDb.close();

  console.log('[demo-init] seeded 3 base users + 6 amenities + 5 work orders (idempotent)');
  console.log('[demo-init] done');
  process.exit(0);
}

main().catch(err => {
  console.error('[demo-init] FAILED', err);
  process.exit(1);
});
