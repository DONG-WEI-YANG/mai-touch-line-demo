/**
 * 錯誤狀態下的自我修復輪詢。
 *
 * 重試次數用完後,React Query 會停在 error 狀態不再嘗試。展示頁上那句
 * 「系統會自動重試,請稍候再操作」就會變成假承諾 —— 限流視窗過去了,畫面
 * 還是死的,業務得在客戶面前重新整理。
 *
 * 解法:只在 error 狀態下開一個慢速輪詢,成功後就關掉。
 */
import { describe, expect, it } from "vitest";

import { recoveryRefetchInterval } from "../src/lib/recovery-interval";

describe("recoveryRefetchInterval", () => {
  it("錯誤狀態下開啟慢速輪詢,讓畫面自己活過來", () => {
    const interval = recoveryRefetchInterval("error");
    expect(typeof interval).toBe("number");
    expect(interval as number).toBeGreaterThanOrEqual(3000);
  });

  it("間隔不能太密 —— 錯誤多半是限流,猛打只會延長限流", () => {
    expect(recoveryRefetchInterval("error") as number).toBeGreaterThanOrEqual(5000);
  });

  it("成功後關閉輪詢,不留背景流量", () => {
    expect(recoveryRefetchInterval("success")).toBe(false);
  });

  it("載入中不另外排程", () => {
    expect(recoveryRefetchInterval("loading")).toBe(false);
    expect(recoveryRefetchInterval("pending")).toBe(false);
  });
});
