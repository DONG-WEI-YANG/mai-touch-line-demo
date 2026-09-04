/**
 * 線上展示資料建置 —— 「上台前一鍵重建」。
 *
 * 為什麼需要它:Render Free 每次重啟或部署都會清空 SQLite(見 deploy-mechanics
 * 記憶),所以示範資料撐不過下一次部署。靠一次性的 one-off job 不夠 —— 業務要能
 * 在接待中心的平板上直接按一下就把展示資料補回來。
 *
 * 冪等:重跑不會產生重複,可以放心在客戶進門前再按一次。
 *
 * 它同時把**驗證內建進回傳值**:語音關鍵字實際會訂到哪一個公設。因為資料庫可能
 * 已經有同義的舊公設(例如英文的 "Fitness Center"),而 buildFacilityMap 是先到
 * 先贏 —— 資料建好不等於演得對,不回報就只能等到客戶面前才發現。
 *
 * 資料定義與 scripts/seed-showcase.ts 共用 showcaseSeedData.ts。
 */
import { buildFacilityMap } from "../_core/voiceCommand";
import * as db from "../db";

import {
  SHOWCASE_AMENITIES,
  SHOWCASE_DEVICES,
  SHOWCASE_RESIDENT,
  SHOWCASE_UNIT,
} from "./showcaseSeedData";

/** 語音會用到的六個設施關鍵字。 */
const FACILITY_KEYS = ["gym", "pool", "lounge", "bbq", "sauna", "meeting_room"] as const;

export type ShowcaseFacilityCheck = {
  key: string;
  amenityId: number | null;
  name: string | null;
  /** true 表示解析到的是這次 seed 建立的示範公設。 */
  isShowcase: boolean;
};

export type ShowcaseSeedResult = {
  unit: { id: number; unitNumber: string; created: boolean };
  resident: { id: number; email: string; created: boolean };
  amenities: { created: number; total: number };
  devices: { created: number; total: number };
  /** 每個語音關鍵字實際會訂到的公設。 */
  facilityCheck: ShowcaseFacilityCheck[];
  /** 被舊資料蓋住、演出來會顯示錯名稱的關鍵字。 */
  shadowed: Array<{ key: string; byAmenityId: number; byName: string }>;
  /** 本次停用了幾筆擋路的舊公設。 */
  deactivated: number;
};

type AmenityRow = { id: number; name?: string | null; isActive?: boolean | number | null };

function isActive(row: AmenityRow): boolean {
  return !(row.isActive === false || row.isActive === 0);
}

export async function seedShowcase(
  opts: { deactivateShadowing?: boolean } = {},
): Promise<ShowcaseSeedResult> {
  // ── 單位 ────────────────────────────────────────────────────────────────
  const units = (await db.getAllUnits()) as Array<{ id: number; unitNumber: string }>;
  let unit = units.find((u) => u.unitNumber === SHOWCASE_UNIT.unitNumber);
  let unitCreated = false;
  if (!unit) {
    const id = await db.createUnit({
      unitNumber: SHOWCASE_UNIT.unitNumber,
      floor: SHOWCASE_UNIT.floor,
      wing: SHOWCASE_UNIT.wing,
      squareFootage: SHOWCASE_UNIT.squareFootage,
    });
    unit = { id, unitNumber: SHOWCASE_UNIT.unitNumber };
    unitCreated = true;
  }

  // ── 示範住戶 ────────────────────────────────────────────────────────────
  const existing = (await db.getUserByEmail(SHOWCASE_RESIDENT.email)) as
    | { id: number; unitId?: number | null }
    | undefined;
  let residentId: number;
  let residentCreated = false;
  if (existing) {
    residentId = existing.id;
    // 舊資料可能沒綁單位(或綁到別的單位)—— 補上,但不重建一個新住戶。
    if (existing.unitId !== unit.id) {
      await db.updateUser(existing.id, { unitId: unit.id } as never);
    }
  } else {
    const created = await db.createUser({
      email: SHOWCASE_RESIDENT.email,
      name: SHOWCASE_RESIDENT.name,
      loginMethod: "showcase",
      openId: SHOWCASE_RESIDENT.openId,
    });
    residentId = created.id;
    residentCreated = true;
    await db.updateUser(residentId, { unitId: unit.id } as never);
  }

  // ── 公設 ────────────────────────────────────────────────────────────────
  let amenityRows = (await db.getAllAmenities()) as AmenityRow[];
  const showcaseAmenityIds = new Set<number>();
  let amenitiesCreated = 0;

  for (const spec of SHOWCASE_AMENITIES) {
    const found = amenityRows.find((a) => (a.name ?? "").trim() === spec.name);
    if (found) {
      showcaseAmenityIds.add(found.id);
      continue;
    }
    const id = await db.createAmenity({
      name: spec.name,
      category: spec.category,
      capacity: spec.capacity,
      openTime: spec.openTime,
      closeTime: spec.closeTime,
      location: spec.location,
    } as never);
    showcaseAmenityIds.add(Number(id));
    amenitiesCreated += 1;
  }
  amenityRows = (await db.getAllAmenities()) as AmenityRow[];

  // ── 住戶家中設備 ────────────────────────────────────────────────────────
  const existingDevices = (await db.getDevicesByUnit(unit.id)) as Array<{ name: string }>;
  let devicesCreated = 0;
  for (const spec of SHOWCASE_DEVICES) {
    if (existingDevices.some((d) => d.name === spec.name)) continue;
    await db.createDevice({
      unitId: unit.id,
      name: spec.name,
      type: spec.type,
      status: spec.status,
    });
    devicesCreated += 1;
  }

  // ── 驗證:語音實際會訂到哪一個公設 ──────────────────────────────────────
  const resolve = (rows: AmenityRow[]): ShowcaseFacilityCheck[] => {
    const map = buildFacilityMap(rows);
    const byId = new Map(rows.map((r) => [r.id, r.name ?? null]));
    return FACILITY_KEYS.map((key) => {
      const amenityId = map.get(key) ?? null;
      return {
        key,
        amenityId,
        name: amenityId === null ? null : (byId.get(amenityId) ?? null),
        isShowcase: amenityId !== null && showcaseAmenityIds.has(amenityId),
      };
    });
  };

  let facilityCheck = resolve(amenityRows);
  let shadowed = facilityCheck
    .filter((f) => f.amenityId !== null && !f.isShowcase)
    .map((f) => ({ key: f.key, byAmenityId: f.amenityId as number, byName: f.name ?? "" }));

  // 預設只回報、不動舊資料 —— 停用別人的公設是有後果的決定,要明確要求才做,
  // 而且只停用真的擋路的那幾筆。
  let deactivated = 0;
  if (opts.deactivateShadowing && shadowed.length > 0) {
    const toDisable = new Set(shadowed.map((s) => s.byAmenityId));
    for (const id of toDisable) {
      await db.updateAmenity(id, { isActive: false } as never);
      deactivated += 1;
    }
    amenityRows = ((await db.getAllAmenities()) as AmenityRow[]).map((row) =>
      toDisable.has(row.id) ? { ...row, isActive: false } : row,
    );
    facilityCheck = resolve(amenityRows.filter(isActive));
    shadowed = facilityCheck
      .filter((f) => f.amenityId !== null && !f.isShowcase)
      .map((f) => ({ key: f.key, byAmenityId: f.amenityId as number, byName: f.name ?? "" }));
  }

  const devicesTotal = ((await db.getDevicesByUnit(unit.id)) as unknown[]).length;

  return {
    unit: { id: unit.id, unitNumber: unit.unitNumber, created: unitCreated },
    resident: { id: residentId, email: SHOWCASE_RESIDENT.email, created: residentCreated },
    amenities: { created: amenitiesCreated, total: showcaseAmenityIds.size },
    devices: { created: devicesCreated, total: devicesTotal },
    facilityCheck,
    shadowed,
    deactivated,
  };
}
