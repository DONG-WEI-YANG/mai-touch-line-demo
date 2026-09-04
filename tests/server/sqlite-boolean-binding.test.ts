/**
 * better-sqlite3 不能綁 JS boolean —— 只吃 number / string / bigint / buffer / null。
 *
 * schema 是 MySQL 型的,`isActive` 宣告成 boolean,於是任何把 `true/false` 傳進
 * update 的呼叫端都會在 SQLite 上炸掉:
 *   "SQLite3 can only bind numbers, strings, bigints, buffers, and null"
 *
 * 這是本專案記錄過的方言陷阱(見 db.ts create* 的既有修正)。這裡把正規化抽成
 * 純函式測起來,因為錯誤只在真的打到 SQLite 時才出現 —— 型別檢查與一般單元
 * 測試都攔不到。
 */
import { describe, expect, it } from "vitest";

import { normalizeForSqlite } from "../../src/server/db";

describe("normalizeForSqlite", () => {
  it("boolean 轉成 0 / 1", () => {
    expect(normalizeForSqlite({ isActive: false })).toEqual({ isActive: 0 });
    expect(normalizeForSqlite({ isActive: true })).toEqual({ isActive: 1 });
  });

  it("其他型別原封不動", () => {
    const now = new Date();
    expect(normalizeForSqlite({ name: "健身房", capacity: 12, note: null, at: now })).toEqual({
      name: "健身房",
      capacity: 12,
      note: null,
      at: now,
    });
  });

  it("undefined 保留 —— 由 drizzle 決定要不要寫入該欄", () => {
    expect(normalizeForSqlite({ a: undefined })).toEqual({ a: undefined });
  });

  it("空物件不炸", () => {
    expect(normalizeForSqlite({})).toEqual({});
  });

  it("多個布林一起轉", () => {
    expect(normalizeForSqlite({ a: true, b: false, c: "x" })).toEqual({ a: 1, b: 0, c: "x" });
  });
});
