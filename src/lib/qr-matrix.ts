/**
 * QR 方陣。
 *
 * `toqr` 回傳的是扁平的 n² Uint8Array,要畫成 SVG 得先切行。抽成純函式是因為
 * 展示情境 3(客戶當場掃碼用自己手機試)完全靠它 —— 掃不出來,現場就演不下去,
 * 而這種錯誤在畫面上看起來只是「一團看似正常的黑點」。
 */
import { toQR } from "toqr";

/** 回傳 n×n 的 0/1 方陣。內容為空時回空陣列。 */
export function toQrMatrix(content: string): number[][] {
  if (!content) return [];

  const flat = toQR(content);
  const size = Math.round(Math.sqrt(flat.length));
  if (size * size !== flat.length) {
    throw new Error(`QR 編碼結果不是方陣(長度 ${flat.length})`);
  }

  const matrix: number[][] = [];
  for (let row = 0; row < size; row += 1) {
    const start = row * size;
    matrix.push(Array.from(flat.slice(start, start + size), (bit) => (bit ? 1 : 0)));
  }
  return matrix;
}
