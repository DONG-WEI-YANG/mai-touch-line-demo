/**
 * showcase router —— 展示模式的伺服端門面。
 *
 * 它自己不含任何領域邏輯:session 描述場次、timeline 委派給純函式、reset 依
 * 兩道護欄刪除。測試要釘死的是授權(只有員工能用)與 reset 的破壞範圍。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const state = {
  users: [] as any[],
  bookings: [] as any[],
  workOrders: [] as any[],
  amenities: [] as any[],
  devices: [] as any[],
  deletedBookings: [] as number[],
  deletedWorkOrders: [] as number[],
};

vi.mock("../../../src/server/db", () => ({
  // 真實行為:SELECT * FROM users,不 join units → 回傳物件沒有 unitNumber。
  getUserByEmail: async (email: string) => {
    const user = state.users.find((u) => u.email === email);
    if (!user) return null;
    const { unitNumber: _dropped, ...withoutUnitNumber } = user;
    return withoutUnitNumber;
  },
  // 只有這支做 units 的 leftJoin,查無單位時回傳字串 "Unassigned"。
  getUserById: async (id: number) => {
    const user = state.users.find((u) => u.id === id);
    if (!user) return undefined;
    return { ...user, unitNumber: user.unitNumber ?? "Unassigned" };
  },
  getAllBookings: async () => state.bookings,
  getAllWorkOrders: async () => state.workOrders,
  getAllAmenities: async () => state.amenities,
  getDevicesByUnit: async (unitId: number) => state.devices.filter((d) => d.unitId === unitId),
  deleteBooking: async (id: number) => { state.deletedBookings.push(id); },
  deleteWorkOrder: async (id: number) => { state.deletedWorkOrders.push(id); },
}));

const SESSION_START = "2026-09-05T10:00:00.000Z";

vi.mock("../../../src/server/services/showcaseSession", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/server/services/showcaseSession")>();
  return {
    ...actual,
    showcaseSessionService: {
      getStartedAt: () => SESSION_START,
      restart: () => SESSION_START,
    },
  };
});

async function caller(user: { id: number; role: string } | null) {
  const { showcaseRouter } = await import("../../../src/server/routers/showcase");
  return showcaseRouter.createCaller({ user } as any);
}

const STAFF = { id: 2, role: "admin" };

beforeEach(async () => {
  const { SHOWCASE_RESIDENT_EMAIL } = await import("../../../src/server/services/showcaseSession");
  state.users = [{ id: 7, email: SHOWCASE_RESIDENT_EMAIL, name: "示範住戶", role: "resident", unitId: 100, unitNumber: "A8-1" }];
  state.bookings = [];
  state.workOrders = [];
  state.amenities = [{ id: 1, name: "健身房 Gym" }];
  state.devices = [{ id: 1, unitId: 100, name: "客廳主燈", type: "light", status: "off" }];
  state.deletedBookings = [];
  state.deletedWorkOrders = [];
});

describe("showcase router · 授權", () => {
  it("住戶不得使用展示模式", async () => {
    const c = await caller({ id: 7, role: "resident" });
    await expect(c.session()).rejects.toThrow(/staff/i);
  });

  it("未登入不得使用", async () => {
    const c = await caller(null);
    await expect(c.session()).rejects.toThrow(/logged in/i);
  });

  it("重置同樣只有員工能呼叫", async () => {
    const c = await caller({ id: 7, role: "resident" });
    await expect(c.reset()).rejects.toThrow(/staff/i);
  });
});

describe("showcase.session", () => {
  it("回傳場次起始時間與示範住戶", async () => {
    const c = await caller(STAFF);
    const session = await c.session();
    expect(session.startedAt).toBe(SESSION_START);
    expect(session.resident).toMatchObject({ id: 7, name: "示範住戶", unitNumber: "A8-1" });
    expect(session.ready).toBe(true);
  });

  it("房號來自 units 的 leftJoin,不是 users 表本身", async () => {
    const c = await caller(STAFF);
    const session = await c.session();
    expect(session.resident?.unitNumber).toBe("A8-1");
  });

  it("示範住戶沒綁單位時房號回 null,不顯示 Unassigned 這種內部字串", async () => {
    state.users[0].unitNumber = undefined;
    const c = await caller(STAFF);
    const session = await c.session();
    expect(session.resident?.unitNumber).toBeNull();
  });

  it("沒有硬體閘道時誠實標為模擬設備", async () => {
    const c = await caller(STAFF);
    const session = await c.session();
    expect(session.hardware.connected).toBe(false);
    expect(session.hardware.label).toBe("模擬設備");
  });

  it("示範住戶尚未建立時回報未就緒,而不是丟例外", async () => {
    state.users = [];
    const c = await caller(STAFF);
    const session = await c.session();
    expect(session.ready).toBe(false);
    expect(session.resident).toBeNull();
    expect(session.blockedReason).toContain("示範住戶");
  });
});

describe("showcase.timeline", () => {
  it("只回本場次示範住戶的事件", async () => {
    state.bookings = [
      { id: 1, userId: 7, amenityId: 1, date: "2026-09-06", startTime: "14:00", endTime: "16:00", status: "confirmed", createdAt: "2026-09-05T10:05:00.000Z" },
      { id: 2, userId: 99, amenityId: 1, date: "2026-09-06", startTime: "14:00", endTime: "16:00", status: "confirmed", createdAt: "2026-09-05T10:06:00.000Z" },
      { id: 3, userId: 7, amenityId: 1, date: "2026-09-06", startTime: "09:00", endTime: "10:00", status: "confirmed", createdAt: "2026-09-05T09:00:00.000Z" },
    ];
    const c = await caller(STAFF);
    const { events } = await c.timeline({});
    expect(events.map((e: any) => e.id)).toEqual(["booking:1"]);
  });

  it("把公設名稱補進事件標題", async () => {
    state.bookings = [
      { id: 1, userId: 7, amenityId: 1, date: "2026-09-06", startTime: "14:00", endTime: "16:00", status: "confirmed", createdAt: "2026-09-05T10:05:00.000Z" },
    ];
    const c = await caller(STAFF);
    const { events } = await c.timeline({});
    expect(events[0].title).toContain("健身房");
  });

  it("示範住戶不存在時回空,不丟例外", async () => {
    state.users = [];
    const c = await caller(STAFF);
    await expect(c.timeline({})).resolves.toMatchObject({ events: [] });
  });
});

describe("showcase.reset", () => {
  beforeEach(() => {
    state.bookings = [
      { id: 1, userId: 7, createdAt: "2026-09-05T10:05:00.000Z" },
      { id: 2, userId: 99, createdAt: "2026-09-05T10:05:00.000Z" },
      { id: 3, userId: 7, createdAt: "2026-09-05T09:00:00.000Z" },
    ];
    state.workOrders = [
      { id: 10, userId: 7, createdAt: "2026-09-05T10:06:00.000Z" },
      { id: 11, userId: 7, createdAt: "2020-01-01T00:00:00.000Z" },
    ];
  });

  it("只刪本場次示範住戶的紀錄", async () => {
    const c = await caller(STAFF);
    const result = await c.reset();
    expect(state.deletedBookings).toEqual([1]);
    expect(state.deletedWorkOrders).toEqual([10]);
    expect(result.removed).toEqual({ bookings: 1, workOrders: 1, voiceEvents: 0 });
  });

  it("絕不碰其他住戶或場次之前的資料", async () => {
    const c = await caller(STAFF);
    await c.reset();
    expect(state.deletedBookings).not.toContain(2);
    expect(state.deletedBookings).not.toContain(3);
    expect(state.deletedWorkOrders).not.toContain(11);
  });

  it("示範住戶解析不到時什麼都不刪", async () => {
    state.users = [];
    const c = await caller(STAFF);
    const result = await c.reset();
    expect(state.deletedBookings).toEqual([]);
    expect(state.deletedWorkOrders).toEqual([]);
    expect(result.removed).toEqual({ bookings: 0, workOrders: 0, voiceEvents: 0 });
  });
});
