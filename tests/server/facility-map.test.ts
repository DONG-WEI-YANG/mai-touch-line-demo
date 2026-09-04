/**
 * buildFacilityMap 把公設名稱對到 amenity id,語音預約靠它把 "gym" 之類的
 * slot 解析成真實公設。原本只比對英文關鍵字 — 中文命名的公設(樣品屋示範
 * 資料就是中文)會得到空 map,語音預約會在客戶面前失敗。
 */
import { describe, expect, it } from "vitest";

import { buildFacilityMap } from "../../src/server/_core/voiceCommand";

describe("buildFacilityMap", () => {
  it("維持既有的英文關鍵字比對", () => {
    const map = buildFacilityMap([
      { id: 1, name: "Sky Infinity Pool" },
      { id: 2, name: "Residents Gym" },
      { id: 3, name: "Private Lounge" },
    ]);
    expect(map.get("pool")).toBe(1);
    expect(map.get("gym")).toBe(2);
    expect(map.get("lounge")).toBe(3);
  });

  it("解析純中文命名的公設", () => {
    const map = buildFacilityMap([
      { id: 10, name: "私人健身房" },
      { id: 11, name: "頂樓泳池" },
      { id: 12, name: "會議室" },
      { id: 13, name: "交誼廳" },
      { id: 14, name: "燒烤露台" },
      { id: 15, name: "三溫暖" },
    ]);
    expect(map.get("gym")).toBe(10);
    expect(map.get("pool")).toBe(11);
    expect(map.get("meeting_room")).toBe(12);
    expect(map.get("lounge")).toBe(13);
    expect(map.get("bbq")).toBe(14);
    expect(map.get("sauna")).toBe(15);
  });

  it("接受同義詞變體", () => {
    const map = buildFacilityMap([
      { id: 20, name: "游泳池" },
      { id: 21, name: "健身中心" },
      { id: 22, name: "烤肉區" },
      { id: 23, name: "蒸氣室" },
      { id: 24, name: "多功能會客室" },
    ]);
    expect(map.get("pool")).toBe(20);
    expect(map.get("gym")).toBe(21);
    expect(map.get("bbq")).toBe(22);
    expect(map.get("sauna")).toBe(23);
    expect(map.get("lounge")).toBe(24);
  });

  it("中英混排命名兩種寫法都解析得到", () => {
    const map = buildFacilityMap([{ id: 30, name: "健身房 Gym" }]);
    expect(map.get("gym")).toBe(30);
  });

  it("無法對應的公設不會塞進 map", () => {
    const map = buildFacilityMap([
      { id: 40, name: "空中花園" },
      { id: 41, name: "Mail Room" },
    ]);
    expect(map.size).toBe(0);
  });

  it("停用的公設不列入 —— 管理員關掉的設施不該還能用語音訂到", () => {
    const map = buildFacilityMap([
      { id: 1, name: "舊健身房", isActive: false },
      { id: 2, name: "私人健身房", isActive: true },
    ]);
    expect(map.get("gym")).toBe(2);
  });

  it("全部停用時該關鍵字就解析不到,而不是退而求其次訂到停用的", () => {
    const map = buildFacilityMap([{ id: 1, name: "健身房", isActive: false }]);
    expect(map.has("gym")).toBe(false);
  });

  it("沒有 isActive 欄位時視為啟用(向後相容既有呼叫端與測試資料)", () => {
    const map = buildFacilityMap([{ id: 1, name: "健身房" }]);
    expect(map.get("gym")).toBe(1);
  });

  it("名稱缺漏不會炸掉", () => {
    const map = buildFacilityMap([{ id: 50, name: null }, { id: 51 }]);
    expect(map.size).toBe(0);
  });
});
