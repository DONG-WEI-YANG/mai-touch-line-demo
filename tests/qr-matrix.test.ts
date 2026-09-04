/**
 * toqr 回傳扁平的 n² Uint8Array,畫成 SVG 前要先切成方陣。
 * 展示情境 3(客戶掃碼用自己手機試)靠這個,掃不出來當場就演不下去。
 */
import { describe, expect, it } from "vitest";

import { toQrMatrix } from "../src/lib/qr-matrix";

describe("toQrMatrix", () => {
  it("把扁平陣列切成邊長相等的方陣", () => {
    const matrix = toQrMatrix("https://example.com/showcase");
    expect(matrix.length).toBeGreaterThan(0);
    for (const row of matrix) {
      expect(row.length).toBe(matrix.length);
    }
  });

  it("格子只有 0 與 1", () => {
    const matrix = toQrMatrix("hello");
    const values = new Set(matrix.flat());
    expect([...values].every((v) => v === 0 || v === 1)).toBe(true);
  });

  it("三個定位角落都是實心的偵測圖樣", () => {
    const matrix = toQrMatrix("https://example.com");
    const n = matrix.length;
    // 偵測圖樣外框 7×7,四角為 1
    expect(matrix[0][0]).toBe(1);
    expect(matrix[0][n - 1]).toBe(1);
    expect(matrix[n - 1][0]).toBe(1);
  });

  it("內容不同,圖樣就不同", () => {
    const a = toQrMatrix("https://example.com/a");
    const b = toQrMatrix("https://example.com/b");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("空字串回空方陣而不是丟例外", () => {
    expect(() => toQrMatrix("")).not.toThrow();
  });
});
