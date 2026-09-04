/**
 * 展示模式右欄「管理中心」的事件流。純函式:把預約、工單、語音稽核三種來源
 * 併成一條依時間排序的事件流,交給展示頁逐條浮現。
 *
 * 這裡的每條規則都是為了讓業務在客戶面前不出糗:順序要對、同一件事不能出現
 * 兩次、壞資料不能讓整個看板空白、上一場次的紀錄不能混進來。
 */
import { describe, expect, it } from "vitest";

import { buildShowcaseTimeline } from "../../src/server/services/showcaseTimeline";

const SESSION_START = "2026-09-05T10:00:00.000Z";

const booking = (over: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 7,
  amenityName: "健身房 Gym",
  date: "2026-09-06",
  startTime: "14:00",
  endTime: "16:00",
  status: "confirmed",
  createdAt: "2026-09-05T10:05:00.000Z",
  ...over,
});

const workOrder = (over: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 7,
  title: "浴室漏水",
  category: "maintenance",
  priority: "high",
  status: "open",
  assignedTo: "王管家",
  createdAt: "2026-09-05T10:06:00.000Z",
  ...over,
});

const voice = (over: Record<string, unknown> = {}) => ({
  id: 1,
  timestamp: "2026-09-05T10:04:00.000Z",
  actorUserId: 2,
  targetUserId: 7,
  source: "staff",
  phase: "command",
  intent: "facility.book",
  outcome: "proposed",
  transcript: "幫我訂週六下午的健身房",
  ...over,
});

describe("buildShowcaseTimeline", () => {
  it("三種來源併成一條、最新的排最前面", () => {
    const events = buildShowcaseTimeline(
      { bookings: [booking()], workOrders: [workOrder()], voiceAudit: [voice()] },
      { since: SESSION_START, residentUserId: 7 },
    );

    expect(events.map((e) => e.kind)).toEqual(["workOrder", "booking", "voice"]);
    expect(events.map((e) => e.at)).toEqual([
      "2026-09-05T10:06:00.000Z",
      "2026-09-05T10:05:00.000Z",
      "2026-09-05T10:04:00.000Z",
    ]);
  });

  it("事件帶著業務唸得出來的中文標題與細節", () => {
    const [e] = buildShowcaseTimeline({ bookings: [booking()] }, { since: SESSION_START, residentUserId: 7 });
    expect(e.title).toContain("健身房");
    expect(e.detail).toContain("14:00");
    expect(e.tone).toBe("success");
  });

  it("工單標題的內部前綴不會漏到客戶眼前", () => {
    // commitVoiceProposal 存的標題帶有 "[repair] " 這類內部意圖標記。
    // 那是給後台看的,不該出現在接待中心的展示畫面上。
    const [e] = buildShowcaseTimeline(
      { workOrders: [workOrder({ title: "[repair] 主臥浴室漏水" })] },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(e.title).toContain("主臥浴室漏水");
    expect(e.title).not.toContain("[repair]");
    expect(e.title).not.toContain("[");
  });

  it("只剝掉開頭的方括號標記,標題中間的括號留著", () => {
    const [e] = buildShowcaseTimeline(
      { workOrders: [workOrder({ title: "冷氣異音 [已到場]" })] },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(e.title).toContain("[已到場]");
  });

  it("語音被拒絕時標為警示,而不是靜靜消失", () => {
    const [e] = buildShowcaseTimeline(
      { voiceAudit: [voice({ phase: "commit", outcome: "rejected", error: "該時段已額滿" })] },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(e.tone).toBe("warning");
    expect(e.detail).toContain("該時段已額滿");
  });

  it("場次開始之前的紀錄不會混進來", () => {
    const events = buildShowcaseTimeline(
      { bookings: [booking({ id: 1, createdAt: "2026-09-05T09:59:59.000Z" }), booking({ id: 2 })] },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(events.map((e) => e.id)).toEqual(["booking:2"]);
  });

  it("別的住戶的紀錄不會混進來", () => {
    const events = buildShowcaseTimeline(
      { bookings: [booking({ id: 1, userId: 99 }), booking({ id: 2, userId: 7 })] },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(events.map((e) => e.id)).toEqual(["booking:2"]);
  });

  it("語音稽核用代操作對象比對,不是操作者", () => {
    const events = buildShowcaseTimeline(
      { voiceAudit: [voice({ actorUserId: 2, targetUserId: 7 })] },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(events).toHaveLength(1);
  });

  it("同一筆重複送進來只留一條", () => {
    const events = buildShowcaseTimeline(
      { bookings: [booking(), booking()] },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(events).toHaveLength(1);
  });

  it("壞掉的時間戳丟掉,其餘照常顯示", () => {
    const events = buildShowcaseTimeline(
      {
        bookings: [booking({ id: 1, createdAt: "not-a-date" }), booking({ id: 2 })],
        workOrders: [workOrder({ id: 3, createdAt: null })],
      },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(events.map((e) => e.id)).toEqual(["booking:2"]);
  });

  it("接受 Date 物件形式的時間戳", () => {
    const events = buildShowcaseTimeline(
      { bookings: [booking({ createdAt: new Date("2026-09-05T10:05:00.000Z") })] },
      { since: SESSION_START, residentUserId: 7 },
    );
    expect(events[0].at).toBe("2026-09-05T10:05:00.000Z");
  });

  it("空輸入回空陣列,不丟例外", () => {
    expect(buildShowcaseTimeline({}, { since: SESSION_START, residentUserId: 7 })).toEqual([]);
  });

  it("limit 只保留最新的幾筆", () => {
    const bookings = Array.from({ length: 10 }, (_, i) =>
      booking({ id: i + 1, createdAt: `2026-09-05T10:${String(10 + i).padStart(2, "0")}:00.000Z` }),
    );
    const events = buildShowcaseTimeline({ bookings }, { since: SESSION_START, residentUserId: 7, limit: 3 });
    expect(events.map((e) => e.id)).toEqual(["booking:10", "booking:9", "booking:8"]);
  });

  it("沒給場次邊界時不做時間過濾", () => {
    const events = buildShowcaseTimeline(
      { bookings: [booking({ createdAt: "2020-01-01T00:00:00.000Z" })] },
      { residentUserId: 7 },
    );
    expect(events).toHaveLength(1);
  });
});
