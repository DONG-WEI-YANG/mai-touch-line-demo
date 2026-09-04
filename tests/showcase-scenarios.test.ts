/**
 * 四個展示情境的定義與可執行性判定。
 *
 * 最關鍵的一條規則:哪些情境在前置條件缺席時仍可演(標示模擬),哪些必須擋下。
 * 分界是「客戶看到的東西是不是真的發生了」——
 *   語音預約沒有硬體照樣是真的預約 → 可演
 *   語音開燈沒有硬體時燈不會亮,但系統狀態確實改變 → 可演,但必須標示模擬設備
 *   LINE 沒設定就推不出訊息,客戶手機不會響 → 擋下,不演假的
 */
import { describe, expect, it } from "vitest";

import {
  SHOWCASE_SCENARIOS,
  scenarioAvailability,
  type ShowcaseReadiness,
} from "../src/lib/showcase-scenarios";

const ready: ShowcaseReadiness = { resident: true, hardware: true, line: true };
const find = (id: string) => SHOWCASE_SCENARIOS.find((s) => s.id === id)!;

describe("SHOWCASE_SCENARIOS", () => {
  it("四個情境對齊簡報階段 1 的四張卡,且順序固定", () => {
    expect(SHOWCASE_SCENARIOS.map((s) => s.id)).toEqual([
      "voice-booking",
      "voice-device",
      "mobile-handoff",
      "line-push",
    ]);
  });

  it("每個情境都帶著業務照唸的話術與客戶看得到的證據", () => {
    for (const s of SHOWCASE_SCENARIOS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.script.length).toBeGreaterThan(0);
      expect(s.proof.length).toBeGreaterThan(0);
    }
  });
});

describe("scenarioAvailability", () => {
  it("前置條件齊備時全部可演,且沒有降級標示", () => {
    for (const s of SHOWCASE_SCENARIOS) {
      const a = scenarioAvailability(s, ready);
      expect(a.runnable).toBe(true);
      expect(a.degraded).toBeUndefined();
    }
  });

  it("沒有示範住戶時,所有情境都擋下", () => {
    const readiness = { ...ready, resident: false };
    for (const s of SHOWCASE_SCENARIOS) {
      const a = scenarioAvailability(s, readiness);
      expect(a.runnable).toBe(false);
      expect(a.blockedReason).toContain("示範住戶");
    }
  });

  it("沒有硬體不影響語音預約 —— 預約本來就是真的", () => {
    const a = scenarioAvailability(find("voice-booking"), { ...ready, hardware: false });
    expect(a.runnable).toBe(true);
    expect(a.degraded).toBeUndefined();
  });

  it("沒有硬體時語音開燈照演,但必須標示模擬設備", () => {
    const a = scenarioAvailability(find("voice-device"), { ...ready, hardware: false });
    expect(a.runnable).toBe(true);
    expect(a.degraded).toContain("模擬");
  });

  it("LINE 沒設定就擋下,不演假的推播", () => {
    const a = scenarioAvailability(find("line-push"), { ...ready, line: false });
    expect(a.runnable).toBe(false);
    expect(a.blockedReason).toContain("LINE");
  });

  it("掃碼試用不依賴硬體與 LINE", () => {
    const a = scenarioAvailability(find("mobile-handoff"), { resident: true, hardware: false, line: false });
    expect(a.runnable).toBe(true);
  });
});
