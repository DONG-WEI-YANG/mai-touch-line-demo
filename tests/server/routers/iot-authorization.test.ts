/**
 * iot.updateDevice 的授權守門。
 *
 * handler 內的 `canControl` 明確允許 admin / logistics 控制任一設備(櫃檯代住戶
 * 操作、樣品屋展示都靠這條),但 procedure 本身標為 residentProcedure —— 守門
 * 擋在前面,那段管理員分支永遠執行不到。授權應該只由 canControl 判斷一次。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const devices = new Map<number, { id: number; unitId: number | null; status: string }>();
const users = new Map<number, { id: number; role: string; unitId: number | null }>();
const statusWrites: Array<{ deviceId: number; status: string }> = [];

vi.mock("../../../src/server/db", () => ({
  getDeviceById: async (id: number) => devices.get(id) ?? null,
  getUserById: async (id: number) => users.get(id) ?? null,
  updateDeviceStatus: async (deviceId: number, status: string) => {
    statusWrites.push({ deviceId, status });
    const d = devices.get(deviceId);
    if (d) d.status = status;
  },
  getDevicesByUnit: async (unitId: number) =>
    [...devices.values()].filter((d) => d.unitId === unitId),
  getDevicesByAmenity: async () => [],
}));

async function caller(user: { id: number; role: string } | null) {
  const { iotRouter } = await import("../../../src/server/routers/iot");
  return iotRouter.createCaller({ user } as any);
}

beforeEach(() => {
  devices.clear();
  users.clear();
  statusWrites.length = 0;
  devices.set(1, { id: 1, unitId: 100, status: "off" });
  users.set(10, { id: 10, role: "resident", unitId: 100 });   // 住在 100 戶
  users.set(11, { id: 11, role: "resident", unitId: 200 });   // 住在別戶
  users.set(20, { id: 20, role: "admin", unitId: null });
  users.set(21, { id: 21, role: "logistics", unitId: null });
});

describe("iot.updateDevice authorization", () => {
  it("管理員可以控制任一戶的設備(櫃檯／展示模式靠這條)", async () => {
    const c = await caller({ id: 20, role: "admin" });
    await expect(c.updateDevice({ deviceId: 1, status: "on" })).resolves.toEqual({ success: true });
    expect(statusWrites).toEqual([{ deviceId: 1, status: "on" }]);
  });

  it("物流／管理職員同樣可以控制", async () => {
    const c = await caller({ id: 21, role: "logistics" });
    await expect(c.updateDevice({ deviceId: 1, status: "on" })).resolves.toEqual({ success: true });
  });

  it("住戶可以控制自己家的設備", async () => {
    const c = await caller({ id: 10, role: "resident" });
    await expect(c.updateDevice({ deviceId: 1, status: "on" })).resolves.toEqual({ success: true });
  });

  it("住戶不能控制別戶的設備", async () => {
    const c = await caller({ id: 11, role: "resident" });
    await expect(c.updateDevice({ deviceId: 1, status: "on" })).rejects.toThrow(/Unauthorized/);
    expect(statusWrites).toHaveLength(0);
  });

  it("token 認證的員工在 users 表裡沒有對應列時仍可控制", async () => {
    // 正式環境的 demo/員工 token 會產生「合成使用者」,資料庫裡沒有那一列。
    // 授權若去 DB 重查 actor 角色就會查無此人 → 誤擋。角色的事實來源是 ctx.user。
    const c = await caller({ id: 999, role: "admin" });
    await expect(c.updateDevice({ deviceId: 1, status: "on" })).resolves.toEqual({ success: true });
  });

  it("token 認證的住戶在 users 表裡查不到時仍被擋下 —— 放寬的只有員工", async () => {
    const c = await caller({ id: 998, role: "resident" });
    await expect(c.updateDevice({ deviceId: 1, status: "on" })).rejects.toThrow(/Unauthorized/);
  });

  it("未登入者一律擋下", async () => {
    const c = await caller(null);
    await expect(c.updateDevice({ deviceId: 1, status: "on" })).rejects.toThrow(/logged in/i);
    expect(statusWrites).toHaveLength(0);
  });

  it("設備不存在時明確報錯,不會寫入狀態", async () => {
    const c = await caller({ id: 20, role: "admin" });
    await expect(c.updateDevice({ deviceId: 999, status: "on" })).rejects.toThrow(/not found/i);
    expect(statusWrites).toHaveLength(0);
  });
});
