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

  // Seed unit (needed for runJob mutation — without unitId, /api/trpc/system.runJob
  // throws "User not assigned to a unit" → 500 when resident clicks any quick action).
  sqliteDb.prepare(`
    INSERT OR IGNORE INTO units (id, unitNumber, floor, wing, squareFootage)
    VALUES (1, '42A', 42, 'East', 1850)
  `).run();

  // id=1 seed@demo.local role='resident' (plan said 'user' but schema requires 'resident')
  sqliteDb.prepare(`
    INSERT OR IGNORE INTO users (id, openId, name, email, loginMethod, role, tier, unitId)
    VALUES (1, 'demo-seed-001', 'Demo Seed User', 'seed@demo.local', 'demo', 'resident', 'Platinum', 1)
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

  // Seed devices for unit 1 so runJob's "arrival" sequence has a climate +
  // light to flip and a meaningful currentStep message in activeJobs.
  const insDevice = sqliteDb.prepare(`
    INSERT OR IGNORE INTO devices (id, unitId, name, type, status)
    VALUES (?, 1, ?, ?, ?)
  `);
  insDevice.run(1, 'Living Room AC', 'climate', '24°C');
  insDevice.run(2, 'Entryway Light', 'light',   'off');
  insDevice.run(3, 'Bedroom Curtain','curtain', 'closed');

  // Seed work orders covering all 7 categories so /logistics-dashboard
  // exercises every category badge (維修/保全/禮賓/打掃/送洗/車輛接送/其他).
  // INSERT OR IGNORE on fixed ids keeps the seed idempotent across redeploys.
  const workOrders = [
    [1, 1, '冷氣不冷',     '主臥室冷氣運轉但出風不冷,可能需要補充冷媒。',          'maintenance', 'high',   'open'],
    [2, 1, '門禁卡失效',   '住戶感應卡刷不過 B1 停車場閘門,煩請補卡。',            'security',    'medium', 'in_progress'],
    [3, 1, '更換燈泡',     '客廳吊燈中央燈泡燒掉一顆,煩請更換。',                  'maintenance', 'low',    'open'],
    [4, 1, '訪客接待',     '週六晚上 19:00 共 6 位訪客來訪 BBQ 區,請協助引導。',  'concierge',   'medium', 'open'],
    [5, 1, '清潔加強',     '近期梯廳味道明顯,煩請加強消毒。',                      'housekeeping','low',    'resolved'],
    [6, 1, '深度打掃',     '本週六 10:00 預約三房廚衛深度清潔,共 3 小時。',        'housekeeping','medium', 'open'],
    [7, 1, '送洗西裝',     '兩套西裝 + 一件大衣,需週四前完成,已放在玄關。',      'laundry',     'medium', 'in_progress'],
    [8, 1, '車輛接送-機場','明日 06:30 桃機 T1 送機,2 位乘客 + 3 件大行李。',     'vehicle',     'high',   'open'],
    [9, 1, '訪客車位',     '今晚 19:00-22:00 安排訪客 1 個臨停車位 (B2)。',         'concierge',   'low',    'open'],
  ] as const;
  const insWo = sqliteDb.prepare(`
    INSERT OR IGNORE INTO work_orders
      (id, userId, title, description, category, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of workOrders) insWo.run(...row);

  // Seed bookings so logistics dashboard's bookings section has data.
  // amenityId 1=gym, 2=pool, 3=meeting_room, 4=lounge, 5=bbq, 6=sauna.
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
  const bookings = [
    [1, 1, 1, fmt(today),     '18:00', '19:00', 1, '晚間健身',           'confirmed'],
    [2, 1, 5, fmt(tomorrow),  '19:00', '21:00', 6, '訪客 BBQ 烤肉聚會',  'pending'],
    [3, 1, 3, fmt(dayAfter),  '14:00', '16:00', 4, '會議室 — 商務洽談',  'confirmed'],
  ] as const;
  const insBk = sqliteDb.prepare(`
    INSERT OR IGNORE INTO bookings
      (id, userId, amenityId, date, startTime, endTime, guestCount, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of bookings) insBk.run(...row);

  sqliteDb.close();

  console.log('[demo-init] seeded 3 base users + 6 amenities + 5 work orders (idempotent)');
  console.log('[demo-init] done');
  process.exit(0);
}

main().catch(err => {
  console.error('[demo-init] FAILED', err);
  process.exit(1);
});
