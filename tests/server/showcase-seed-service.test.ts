/**
 * 線上展示資料建置。
 *
 * Render Free 每次重啟/部署都會清空 SQLite(見 deploy-mechanics),所以展示資料
 * 必須能「上台前幾秒重建」,而不是靠一次性的 one-off job。這支服務就是那個
 * 一鍵重建,由 showcase.seed 呼叫。
 *
 * 它同時把驗證內建進回傳值:語音關鍵字實際會訂到哪一個公設。因為舊資料庫可能
 * 已經有同義的英文公設,而 buildFacilityMap 是先到先贏 —— 建好資料不代表演得對。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = {
  units: [] as any[],
  users: [] as any[],
  amenities: [] as any[],
  devices: [] as any[],
  updatedAmenities: [] as Array<{ id: number; data: any }>,
  updatedUsers: [] as Array<{ id: number; data: any }>,
};

let nextId = 1;

vi.mock("../../src/server/db", () => ({
  getAllUnits: async () => state.units,
  createUnit: async (d: any) => { const id = nextId++; state.units.push({ id, ...d }); return id; },
  getUserByEmail: async (email: string) => state.users.find((u) => u.email === email),
  createUser: async (d: any) => { const id = nextId++; state.users.push({ id, ...d }); return { id, ...d }; },
  updateUser: async (id: number, d: any) => {
    state.updatedUsers.push({ id, data: d });
    Object.assign(state.users.find((u) => u.id === id) ?? {}, d);
  },
  getAllAmenities: async () => state.amenities,
  createAmenity: async (d: any) => { const id = nextId++; state.amenities.push({ id, isActive: true, ...d }); return id; },
  updateAmenity: async (id: number, d: any) => {
    state.updatedAmenities.push({ id, data: d });
    Object.assign(state.amenities.find((a) => a.id === id) ?? {}, d);
  },
  getDevicesByUnit: async (unitId: number) => state.devices.filter((d) => d.unitId === unitId),
  createDevice: async (d: any) => { const id = nextId++; state.devices.push({ id, ...d }); return id; },
}));

async function seed(opts?: { deactivateShadowing?: boolean }) {
  const { seedShowcase } = await import("../../src/server/services/showcaseSeed");
  return seedShowcase(opts);
}

beforeEach(() => {
  nextId = 1;
  state.units = [];
  state.users = [];
  state.amenities = [];
  state.devices = [];
  state.updatedAmenities = [];
  state.updatedUsers = [];
});

describe("seedShowcase", () => {
  it("在空資料庫上建立單位、住戶、六個公設、五個設備", async () => {
    const result = await seed();
    expect(result.unit.created).toBe(true);
    expect(result.resident.created).toBe(true);
    expect(result.amenities.created).toBe(6);
    expect(result.devices.created).toBe(5);
  });

  it("重跑不會產生重複 —— 上台前可以放心再按一次", async () => {
    await seed();
    const second = await seed();
    expect(second.amenities.created).toBe(0);
    expect(second.devices.created).toBe(0);
    expect(second.resident.created).toBe(false);
    expect(state.users).toHaveLength(1);
    expect(state.amenities).toHaveLength(6);
    expect(state.devices).toHaveLength(5);
  });

  it("回報語音關鍵字實際會訂到哪一個公設", async () => {
    const result = await seed();
    const gym = result.facilityCheck.find((f) => f.key === "gym");
    expect(gym?.name).toBe("私人健身房");
    expect(gym?.isShowcase).toBe(true);
    expect(result.facilityCheck).toHaveLength(6);
  });

  it("舊的同義公設會蓋住示範公設時,誠實回報 shadowed", async () => {
    // 先到先贏:舊的 Fitness Center id 較小,語音會訂到它而不是「私人健身房」。
    state.amenities.push({ id: 100, name: "Fitness Center", isActive: true });
    nextId = 101;
    const result = await seed();
    const gym = result.facilityCheck.find((f) => f.key === "gym");
    expect(gym?.name).toBe("Fitness Center");
    expect(gym?.isShowcase).toBe(false);
    expect(result.shadowed.map((s) => s.key)).toContain("gym");
  });

  it("預設不動舊資料 —— 只回報,不擅自停用", async () => {
    state.amenities.push({ id: 100, name: "Fitness Center", isActive: true });
    nextId = 101;
    const result = await seed();
    expect(result.deactivated).toBe(0);
    expect(state.updatedAmenities).toHaveLength(0);
  });

  it("明確要求時才停用擋路的舊公設,而且只停用擋路的那幾筆", async () => {
    state.amenities.push({ id: 100, name: "Fitness Center", isActive: true });
    state.amenities.push({ id: 101, name: "Private Dining Room", isActive: true });
    nextId = 102;
    const result = await seed({ deactivateShadowing: true });
    expect(result.deactivated).toBe(1);
    expect(state.updatedAmenities).toEqual([{ id: 100, data: { isActive: false } }]);
    // 沒擋路的舊公設不受影響。
    expect(state.amenities.find((a) => a.id === 101).isActive).toBe(true);
  });

  it("停用之後語音就會訂到示範公設", async () => {
    state.amenities.push({ id: 100, name: "Fitness Center", isActive: true });
    nextId = 101;
    const result = await seed({ deactivateShadowing: true });
    const gym = result.facilityCheck.find((f) => f.key === "gym");
    expect(gym?.name).toBe("私人健身房");
    expect(gym?.isShowcase).toBe(true);
    expect(result.shadowed).toEqual([]);
  });

  it("既有住戶缺少單位綁定時補上,不重建一個新住戶", async () => {
    state.units.push({ id: 50, unitNumber: "A8-1" });
    state.users.push({ id: 60, email: "showcase.resident@demo.local", name: "王雅琳", unitId: null });
    nextId = 61;
    const result = await seed();
    expect(result.resident.created).toBe(false);
    expect(state.updatedUsers).toEqual([{ id: 60, data: { unitId: 50 } }]);
  });
});
