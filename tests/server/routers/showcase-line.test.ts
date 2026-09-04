/**
 * 展示情境 4:加 LINE 就收得到社區訊息。
 *
 * 簡報的承諾是「現場推一則示範公告,**客戶的 LINE** 當場收到」。既有的
 * lineAdmin.scriptRun 做不到這件事 —— 它只查「管理員自己綁定的裝置」
 * (WHERE app_user_id = ctx.user.id),而且展示模式用的是 token 合成管理員,
 * 資料庫裡永遠沒有那一列(與 iot.updateDevice 同一類的 bug)。
 *
 * 所以展示模式需要能「推給指定的 LINE 使用者」:客戶掃碼加好友後出現在名單
 * 最上方,業務點一下就推給他。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const pushed: Array<{ scriptId: string; lineUserId: string }> = [];

vi.mock("../../../src/server/line/handlers/demo", () => ({
  startDemo: async (scriptId: string, deps: { lineUser: { lineUserId: string } }) => {
    pushed.push({ scriptId, lineUserId: deps.lineUser.lineUserId });
  },
}));

vi.mock("../../../src/server/line/demo-scripts", () => ({
  listScripts: () => [
    { id: "facility", title: { "zh-TW": "公設預約示範" }, steps: [] },
    { id: "repair", title: { "zh-TW": "報修示範" }, steps: [] },
  ],
  getScript: (id: string) => ({ id, steps: [] }),
}));

vi.mock("../../../src/server/db", () => ({
  getUserByEmail: async () => ({ id: 1, name: "王雅琳", role: "resident", unitId: 1 }),
  getUserById: async () => ({ id: 1, name: "王雅琳", role: "resident", unitId: 1, unitNumber: "A8-1" }),
  getAllBookings: async () => [],
  getAllWorkOrders: async () => [],
  getAllAmenities: async () => [],
  getDevicesByUnit: async () => [],
  deleteBooking: async () => {},
  deleteWorkOrder: async () => {},
}));

const lineUsers = [
  { lineUserId: "U" + "a".repeat(32), displayName: "剛加入的客戶", language: "zh-TW", createdAt: "2026-09-05T02:00:00Z" },
  { lineUserId: "U" + "b".repeat(32), displayName: "王管家", language: "zh-TW", createdAt: "2026-09-01T02:00:00Z" },
];

function lineCtx() {
  return {
    channelId: "test-channel",
    sessionStore: { get: () => undefined, set: () => {} },
    lineClient: { push: async () => {} },
    runSideEffect: async () => {},
    db: {
      prepare: () => ({
        all: () => lineUsers.map((u, i) => ({
          id: lineUsers.length - i,
          lineUserId: u.lineUserId,
          displayName: u.displayName,
          language: u.language,
          createdAt: u.createdAt,
          isDemo: 0,
        })),
        // 成員檢查:在參數裡找 LINE user id,找得到才回傳(模擬 WHERE 條件)。
        get: (...params: unknown[]) => {
          const wanted = params.find((p) => typeof p === "string" && p.startsWith("U"));
          const hit = lineUsers.find((u) => u.lineUserId === wanted);
          return hit ? { lineUserId: hit.lineUserId, language: hit.language } : undefined;
        },
        run: () => ({ changes: 0 }),
      }),
    },
  };
}

async function caller(user: { id: number; role: string } | null, withLine = true) {
  const { showcaseRouter } = await import("../../../src/server/routers/showcase");
  return showcaseRouter.createCaller({
    user,
    lineAdmin: withLine ? lineCtx() : undefined,
  } as any);
}

const STAFF = { id: 2, role: "admin" };

beforeEach(() => {
  pushed.length = 0;
  process.env.LINE_BOT_BASIC_ID = "@testbot";
});

describe("showcase.lineAudience", () => {
  it("回報 LINE 已設定,並給出加好友連結給客戶掃", async () => {
    const c = await caller(STAFF);
    const audience = await c.lineAudience();
    expect(audience.configured).toBe(true);
    expect(audience.addFriendUrl).toContain("line.me");
    expect(audience.addFriendUrl).toContain("%40testbot");
  });

  it("好友名單最新加入的排最前面 —— 剛掃碼的客戶就在第一個", async () => {
    const c = await caller(STAFF);
    const audience = await c.lineAudience();
    expect(audience.recipients[0].displayName).toBe("剛加入的客戶");
  });

  it("列出可推送的示範腳本", async () => {
    const c = await caller(STAFF);
    const audience = await c.lineAudience();
    expect(audience.scripts.map((s: { id: string }) => s.id)).toEqual(["facility", "repair"]);
  });

  it("LINE 未設定時誠實回報,不給假的加好友連結", async () => {
    const c = await caller(STAFF, false);
    const audience = await c.lineAudience();
    expect(audience.configured).toBe(false);
    expect(audience.addFriendUrl).toBeNull();
    expect(audience.recipients).toEqual([]);
  });

  it("環境變數與 LINE API 都問不到基本 ID 時不給連結,不讓客戶掃一個壞的碼", async () => {
    delete process.env.LINE_BOT_BASIC_ID;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const c = await caller(STAFF);
    const audience = await c.lineAudience();
    expect(audience.addFriendUrl).toBeNull();
  });

  it("環境變數沒設但有 channel token 時,基本 ID 由 LINE API 補上", async () => {
    delete process.env.LINE_BOT_BASIC_ID;
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "fake-token";
    const { resetLineBotIdentityCache } = await import(
      "../../../src/server/services/lineBotIdentity"
    );
    resetLineBotIdentityCache();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ basicId: "@679ntrul" }),
    } as Response);
    try {
      const c = await caller(STAFF);
      const audience = await c.lineAudience();
      expect(audience.addFriendUrl).toBe("https://line.me/R/ti/p/%40679ntrul");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.line.me/v2/bot/info",
        expect.objectContaining({ headers: { Authorization: "Bearer fake-token" } }),
      );
    } finally {
      fetchSpy.mockRestore();
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
      resetLineBotIdentityCache();
    }
  });
});

describe("showcase.linePush", () => {
  const target = "U" + "a".repeat(32);

  it("推給指定的客戶,不是推給操作的業務自己", async () => {
    const c = await caller(STAFF);
    const result = await c.linePush({ scriptId: "facility", lineUserId: target });
    expect(result.ok).toBe(true);
    expect(pushed).toEqual([{ scriptId: "facility", lineUserId: target }]);
  });

  it("token 認證的管理員沒有自己的 LINE 綁定也推得出去", async () => {
    // 這正是 lineAdmin.scriptRun 做不到的事:它只查 app_user_id = ctx.user.id。
    const c = await caller({ id: 999, role: "admin" });
    await expect(c.linePush({ scriptId: "facility", lineUserId: target })).resolves.toMatchObject({ ok: true });
  });

  it("LINE 未設定時擋下,而且不假裝推成功", async () => {
    const c = await caller(STAFF, false);
    await expect(c.linePush({ scriptId: "facility", lineUserId: target })).rejects.toThrow(/LINE/);
    expect(pushed).toHaveLength(0);
  });

  it("拒絕不在好友名單裡的 LINE 使用者 —— 不能對任意 id 發訊息", async () => {
    const c = await caller(STAFF);
    await expect(
      c.linePush({ scriptId: "facility", lineUserId: "U" + "9".repeat(32) }),
    ).rejects.toThrow();
    expect(pushed).toHaveLength(0);
  });

  it("格式不對的 LINE user id 直接被 schema 擋掉", async () => {
    const c = await caller(STAFF);
    await expect(c.linePush({ scriptId: "facility", lineUserId: "not-a-line-id" })).rejects.toThrow();
  });

  it("住戶不能操作展示推播", async () => {
    const c = await caller({ id: 1, role: "resident" });
    await expect(c.linePush({ scriptId: "facility", lineUserId: target })).rejects.toThrow(/staff/i);
  });
});
