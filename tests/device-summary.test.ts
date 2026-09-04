/**
 * 智慧家庭頁的摘要列。原本寫死「22.5°C • Perfect Ambiance」—— 不管實際有沒有
 * 空調、也不管它是開是關,永遠顯示同一句。示範現場最怕這種:客戶把冷氣關掉,
 * 畫面還說 Perfect Ambiance。
 */
import { describe, expect, it } from "vitest";

import { summarizeDevices } from "../src/lib/device-summary";

const d = (over: Record<string, unknown> = {}) => ({
  id: 1, name: "客廳主燈", type: "light", status: "off", ...over,
});

describe("summarizeDevices", () => {
  it("數出開啟中的設備", () => {
    const s = summarizeDevices([d({ id: 1, status: "on" }), d({ id: 2, status: "off" }), d({ id: 3, status: "on" })]);
    expect(s.total).toBe(3);
    expect(s.activeCount).toBe(2);
  });

  it("找出空調並回報它真實的狀態字串", () => {
    const s = summarizeDevices([d({ id: 1 }), d({ id: 2, name: "客廳空調", type: "climate", status: "26°C" })]);
    expect(s.climate).toEqual({ name: "客廳空調", status: "26°C" });
  });

  it("沒有空調就回 null —— 呼叫端據此不畫那張卡,而不是編一個溫度", () => {
    expect(summarizeDevices([d()]).climate).toBeNull();
  });

  it("多台空調取第一台,不合併出一個不存在的平均值", () => {
    const s = summarizeDevices([
      d({ id: 1, name: "客廳空調", type: "climate", status: "26°C" }),
      d({ id: 2, name: "主臥空調", type: "climate", status: "24°C" }),
    ]);
    expect(s.climate?.name).toBe("客廳空調");
  });

  it("空清單不丟例外", () => {
    expect(summarizeDevices([])).toEqual({ total: 0, activeCount: 0, climate: null });
  });

  it("狀態不是 off 的空調視為運轉中", () => {
    const s = summarizeDevices([d({ name: "空調", type: "climate", status: "26°C" })]);
    expect(s.activeCount).toBe(1);
  });
});
