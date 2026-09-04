/**
 * 示範資料的正確性 —— 這份資料錯了,展示現場就演不出來,而且錯得很安靜:
 * 公設名稱解析不到只會表現為「語音聽懂了但訂不到」。
 */
import { describe, expect, it } from "vitest";

import { buildFacilityMap } from "../../src/server/_core/voiceCommand";
import {
  SHOWCASE_AMENITIES,
  SHOWCASE_DEVICES,
  SHOWCASE_RESIDENT,
  SHOWCASE_UNIT,
} from "../../src/server/services/showcaseSeedData";
import { SHOWCASE_RESIDENT_EMAIL } from "../../src/server/services/showcaseSession";

describe("示範公設", () => {
  it("六個公設全部能被語音解析到 —— 缺一個就是一個演不出來的情境", () => {
    const map = buildFacilityMap(SHOWCASE_AMENITIES.map((a, i) => ({ id: i + 1, name: a.name })));
    for (const key of ["gym", "pool", "lounge", "bbq", "sauna", "meeting_room"]) {
      expect(map.has(key), `公設 ${key} 無法由名稱解析`).toBe(true);
    }
  });

  it("沒有兩個公設搶到同一個語音關鍵字", () => {
    const map = buildFacilityMap(SHOWCASE_AMENITIES.map((a, i) => ({ id: i + 1, name: a.name })));
    expect(new Set(map.values()).size).toBe(map.size);
  });

  it("名稱是中文的 —— 業務唸得出口才有建案感", () => {
    for (const amenity of SHOWCASE_AMENITIES) {
      expect(amenity.name).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it("開放時段合理且結束晚於開始", () => {
    for (const a of SHOWCASE_AMENITIES) {
      expect(a.openTime).toMatch(/^\d{2}:\d{2}$/);
      expect(a.closeTime).toMatch(/^\d{2}:\d{2}$/);
      expect(a.closeTime > a.openTime).toBe(true);
      expect(a.capacity).toBeGreaterThan(0);
    }
  });
});

describe("示範住戶", () => {
  it("email 與 showcase router 解析用的常數一致", () => {
    expect(SHOWCASE_RESIDENT.email).toBe(SHOWCASE_RESIDENT_EMAIL);
  });

  it("角色是 resident —— staffCommit 會拒絕非住戶的代辦對象", () => {
    expect(SHOWCASE_RESIDENT.role).toBe("resident");
  });

  it("有房號可顯示在展示頁頂端", () => {
    expect(SHOWCASE_UNIT.unitNumber).toBeTruthy();
  });
});

describe("示範設備", () => {
  it("涵蓋簡報上講的燈光、空調、窗簾", () => {
    const types = new Set(SHOWCASE_DEVICES.map((d) => d.type));
    expect(types.has("light")).toBe(true);
    expect(types.has("climate")).toBe(true);
    expect(types.has("curtain")).toBe(true);
  });

  it("初始全部關閉 —— 展示要從「關著」開始才看得到變化", () => {
    for (const device of SHOWCASE_DEVICES) {
      expect(device.status).toBe("off");
    }
  });

  it("設備名稱不重複", () => {
    expect(new Set(SHOWCASE_DEVICES.map((d) => d.name)).size).toBe(SHOWCASE_DEVICES.length);
  });
});
