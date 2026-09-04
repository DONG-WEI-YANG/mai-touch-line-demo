/**
 * /api/* 的請求上限。
 *
 * 原本是 express-rate-limit 樣板值 100 req / 15 min / IP。那個數字對「沒有登入
 * 態、只打幾支 REST」的服務合理,但這個 App 是 tRPC + React Query 的 SPA:
 * 光是登入後開一頁就會批次打好幾支,樣品屋展示模式還要輪詢管理中心事件流。
 * 實測 2 秒輪詢約 3.3 分鐘就會在客戶面前撞牆並回 429。
 *
 * 這裡把上限改為可由環境變數調整,預設值放寬到足以支撐真實 UI,但仍是有意義
 * 的濫用防線(未登入者也受同一條限制)。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL = process.env.API_RATE_LIMIT_MAX;

async function loadConfig() {
  // 上限在模組載入時就固定下來,所以每次都要重置模組登錄表再 import。
  vi.resetModules();
  const mod = await import("../../src/server/middleware/rateLimit");
  return mod.RATE_LIMIT_CONFIG;
}

beforeEach(() => { delete process.env.API_RATE_LIMIT_MAX; });
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.API_RATE_LIMIT_MAX;
  else process.env.API_RATE_LIMIT_MAX = ORIGINAL;
});

describe("API rate limit", () => {
  it("預設值足以支撐一場輪詢中的展示(> 每分鐘 20 次)", async () => {
    const config = await loadConfig();
    const perMinute = config.api.max / (config.api.windowMs / 60_000);
    expect(perMinute).toBeGreaterThan(20);
  });

  it("仍然是有上限的 —— 不是關掉防線", async () => {
    const config = await loadConfig();
    expect(config.api.max).toBeLessThanOrEqual(2000);
    expect(config.api.windowMs).toBeGreaterThan(0);
  });

  it("可由 API_RATE_LIMIT_MAX 覆寫", async () => {
    process.env.API_RATE_LIMIT_MAX = "250";
    const config = await loadConfig();
    expect(config.api.max).toBe(250);
  });

  it("環境變數是垃圾時退回預設值,不會變成 NaN 而讓所有請求被擋", async () => {
    process.env.API_RATE_LIMIT_MAX = "not-a-number";
    const config = await loadConfig();
    expect(Number.isFinite(config.api.max)).toBe(true);
    expect(config.api.max).toBeGreaterThan(0);
  });

  it("登入端點維持嚴格 —— 放寬的只有一般 API", async () => {
    const config = await loadConfig();
    expect(config.auth.max).toBeLessThanOrEqual(10);
  });
});
