/**
 * 樣品屋示範資料建置。
 *
 * 冪等 —— 重跑不會產生重複的住戶、公設或設備,所以業務可以放心在展示前
 * 再跑一次確認。資料定義來自 src/server/services/showcaseSeedData.ts,
 * 與展示頁、reset 共用同一份真實來源。
 *
 * 用法:npm run seed:showcase
 */
import "dotenv/config";
import fs from "fs";
import path from "path";

import { dbManager } from "../src/server/database/adapter";
import { runMigrations } from "../src/server/database/migrate";
import {
  SHOWCASE_AMENITIES,
  SHOWCASE_DEVICES,
  SHOWCASE_RESIDENT,
  SHOWCASE_UNIT,
} from "../src/server/services/showcaseSeedData";

type Sqlite = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => { lastInsertRowid: number | bigint };
    get: (...args: unknown[]) => unknown;
  };
};

async function main(): Promise<void> {
  const dbPath = process.env.SQLITE_FILENAME ?? "./data/mai-touch.db";
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  process.env.SQLITE_FILENAME = dbPath;

  console.log(`[showcase-seed] 資料庫:${dbPath}`);
  await dbManager.connect();
  await runMigrations();
  console.log("[showcase-seed] migrations 完成");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const db: Sqlite = new Database(path.resolve(dbPath));

  // ── 單位 ──────────────────────────────────────────────────────
  db.prepare(
    `INSERT OR IGNORE INTO units (unitNumber, floor, wing, squareFootage) VALUES (?, ?, ?, ?)`,
  ).run(SHOWCASE_UNIT.unitNumber, SHOWCASE_UNIT.floor, SHOWCASE_UNIT.wing, SHOWCASE_UNIT.squareFootage);
  const unit = db
    .prepare(`SELECT id FROM units WHERE unitNumber = ?`)
    .get(SHOWCASE_UNIT.unitNumber) as { id: number };
  console.log(`[showcase-seed] 單位 ${SHOWCASE_UNIT.unitNumber} (id=${unit.id})`);

  // ── 示範住戶 ──────────────────────────────────────────────────
  // openId 有 unique 約束,拿它當冪等鍵;既有列則補綁單位,避免舊資料殘留 null。
  db.prepare(
    `INSERT OR IGNORE INTO users (openId, name, email, role, unitId, tier, loginMethod)
     VALUES (?, ?, ?, ?, ?, ?, 'showcase')`,
  ).run(
    SHOWCASE_RESIDENT.openId,
    SHOWCASE_RESIDENT.name,
    SHOWCASE_RESIDENT.email,
    SHOWCASE_RESIDENT.role,
    unit.id,
    SHOWCASE_RESIDENT.tier,
  );
  db.prepare(`UPDATE users SET unitId = ?, name = ?, role = ? WHERE openId = ?`).run(
    unit.id,
    SHOWCASE_RESIDENT.name,
    SHOWCASE_RESIDENT.role,
    SHOWCASE_RESIDENT.openId,
  );
  const resident = db
    .prepare(`SELECT id FROM users WHERE openId = ?`)
    .get(SHOWCASE_RESIDENT.openId) as { id: number };
  console.log(`[showcase-seed] 住戶 ${SHOWCASE_RESIDENT.name} (id=${resident.id})`);

  // ── 公設 ──────────────────────────────────────────────────────
  let amenityCount = 0;
  for (const amenity of SHOWCASE_AMENITIES) {
    const existing = db.prepare(`SELECT id FROM amenities WHERE name = ?`).get(amenity.name);
    if (existing) continue;
    db.prepare(
      `INSERT INTO amenities (name, category, capacity, openTime, closeTime, location, icon)
       VALUES (?, ?, ?, ?, ?, ?, 'star')`,
    ).run(
      amenity.name,
      amenity.category,
      amenity.capacity,
      amenity.openTime,
      amenity.closeTime,
      amenity.location,
    );
    amenityCount += 1;
  }
  console.log(`[showcase-seed] 公設 ${SHOWCASE_AMENITIES.length} 項(新增 ${amenityCount})`);

  // ── 住戶家中設備 ──────────────────────────────────────────────
  let deviceCount = 0;
  for (const device of SHOWCASE_DEVICES) {
    const existing = db
      .prepare(`SELECT id FROM devices WHERE unitId = ? AND name = ?`)
      .get(unit.id, device.name);
    if (existing) continue;
    db.prepare(`INSERT INTO devices (unitId, name, type, status) VALUES (?, ?, ?, ?)`).run(
      unit.id,
      device.name,
      device.type,
      device.status,
    );
    deviceCount += 1;
  }
  console.log(`[showcase-seed] 設備 ${SHOWCASE_DEVICES.length} 項(新增 ${deviceCount})`);

  console.log("[showcase-seed] 完成 —— 開啟 /showcase 即可開始展示");
}

main().catch((error) => {
  console.error("[showcase-seed] 失敗:", error);
  process.exit(1);
});
