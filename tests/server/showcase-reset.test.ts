/**
 * 重置的選取邏輯 —— 展示模式唯一會刪資料的地方,所以護欄寫成純函式單獨釘死。
 *
 * 兩道護欄必須同時成立才刪:
 *   1. 這筆資料屬於示範住戶
 *   2. 這筆資料是本場次(場次起始時間之後)產生的
 * 任何一道不成立就保留。寧可留下垃圾,不可誤刪正式資料。
 */
import { describe, expect, it } from "vitest";

import { selectShowcaseResetTargets } from "../../src/server/services/showcaseReset";

const SESSION = "2026-09-05T10:00:00.000Z";
const POLICY = { residentUserId: 7, sessionStartedAt: SESSION };

const row = (over: Record<string, unknown> = {}) => ({
  kind: "booking" as const,
  id: 1,
  userId: 7,
  createdAt: "2026-09-05T10:05:00.000Z",
  ...over,
});

describe("selectShowcaseResetTargets", () => {
  it("本場次、示範住戶的紀錄會被選中", () => {
    const targets = selectShowcaseResetTargets([row()], POLICY);
    expect(targets).toEqual([{ kind: "booking", id: 1 }]);
  });

  it("別的住戶的紀錄一律保留", () => {
    expect(selectShowcaseResetTargets([row({ userId: 99 })], POLICY)).toEqual([]);
  });

  it("沒有住戶歸屬的紀錄一律保留", () => {
    expect(selectShowcaseResetTargets([row({ userId: null })], POLICY)).toEqual([]);
    expect(selectShowcaseResetTargets([row({ userId: undefined })], POLICY)).toEqual([]);
  });

  it("場次開始之前的紀錄一律保留", () => {
    expect(selectShowcaseResetTargets([row({ createdAt: "2026-09-05T09:59:59.999Z" })], POLICY)).toEqual([]);
  });

  it("時間戳壞掉或缺漏時保留,不猜", () => {
    expect(selectShowcaseResetTargets([row({ createdAt: "not-a-date" })], POLICY)).toEqual([]);
    expect(selectShowcaseResetTargets([row({ createdAt: null })], POLICY)).toEqual([]);
  });

  it("剛好等於場次起始時間的紀錄算本場次", () => {
    expect(selectShowcaseResetTargets([row({ createdAt: SESSION })], POLICY)).toHaveLength(1);
  });

  it("接受 Date 物件形式的時間戳", () => {
    const targets = selectShowcaseResetTargets([row({ createdAt: new Date("2026-09-05T10:05:00.000Z") })], POLICY);
    expect(targets).toHaveLength(1);
  });

  it("混合輸入只挑出符合兩道護欄的那幾筆", () => {
    const targets = selectShowcaseResetTargets(
      [
        row({ id: 1 }),
        row({ id: 2, userId: 99 }),
        row({ kind: "workOrder", id: 3 }),
        row({ id: 4, createdAt: "2020-01-01T00:00:00.000Z" }),
      ],
      POLICY,
    );
    expect(targets).toEqual([
      { kind: "booking", id: 1 },
      { kind: "workOrder", id: 3 },
    ]);
  });

  it("示範住戶解析不到時什麼都不刪", () => {
    const targets = selectShowcaseResetTargets([row()], { residentUserId: undefined, sessionStartedAt: SESSION });
    expect(targets).toEqual([]);
  });

  it("場次起始時間無效時什麼都不刪", () => {
    const targets = selectShowcaseResetTargets([row()], { residentUserId: 7, sessionStartedAt: "nonsense" });
    expect(targets).toEqual([]);
  });
});
