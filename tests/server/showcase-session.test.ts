/**
 * 展示場次服務。兩個職責:記住「這一場」從何時開始(重置的時間護欄),
 * 以及誠實描述硬體連線狀態。
 *
 * 硬體那條是紀律問題:樣品屋現場多半還沒接真設備,畫面必須標「模擬設備」。
 * 把未驗證的狀態報成已連線,等於在客戶面前說謊。
 */
import { describe, expect, it, beforeEach } from "vitest";

import { ShowcaseSessionService, describeShowcaseHardware } from "../../src/server/services/showcaseSession";

const health = (over: Record<string, unknown> = {}) =>
  ({
    status: "healthy",
    config: {
      dryRun: false,
      strictMode: false,
      timeoutMs: 5000,
      adapterRequested: "http",
      adapterResolved: "http",
      baseUrlConfigured: true,
      apiKeyConfigured: true,
      ...(over.config as Record<string, unknown> | undefined),
    },
  }) as any;

describe("describeShowcaseHardware", () => {
  it("閘道設好且非空跑時才說已連線", () => {
    const hw = describeShowcaseHardware(health());
    expect(hw.connected).toBe(true);
    expect(hw.label).toBe("已連線");
  });

  it("沒設定閘道位址時標為模擬設備", () => {
    const hw = describeShowcaseHardware(health({ config: { baseUrlConfigured: false } }));
    expect(hw.connected).toBe(false);
    expect(hw.label).toBe("模擬設備");
    expect(hw.reason).toContain("尚未設定");
  });

  it("空跑模式即使有位址也算模擬,不得宣稱已連線", () => {
    const hw = describeShowcaseHardware(health({ config: { dryRun: true } }));
    expect(hw.connected).toBe(false);
    expect(hw.label).toBe("模擬設備");
    expect(hw.reason).toContain("空跑");
  });

  it("轉接器解析不出來時算模擬", () => {
    const hw = describeShowcaseHardware(health({ config: { adapterResolved: null } }));
    expect(hw.connected).toBe(false);
  });

  it("拿不到健康資訊時保守地當作模擬", () => {
    expect(describeShowcaseHardware(null).connected).toBe(false);
    expect(describeShowcaseHardware(undefined as any).connected).toBe(false);
  });
});

describe("ShowcaseSessionService", () => {
  let clock: Date;
  let service: ShowcaseSessionService;

  beforeEach(() => {
    clock = new Date("2026-09-05T10:00:00.000Z");
    service = new ShowcaseSessionService({ now: () => clock });
  });

  it("場次起始時間在服務建立時就固定下來", () => {
    const first = service.getStartedAt();
    clock = new Date("2026-09-05T11:00:00.000Z");
    expect(service.getStartedAt()).toBe(first);
    expect(first).toBe("2026-09-05T10:00:00.000Z");
  });

  it("重新開場把邊界推到現在", () => {
    clock = new Date("2026-09-05T12:30:00.000Z");
    const restarted = service.restart();
    expect(restarted).toBe("2026-09-05T12:30:00.000Z");
    expect(service.getStartedAt()).toBe(restarted);
  });
});
