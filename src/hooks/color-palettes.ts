/**
 * 色票 —— 純資料,不 import react-native,所以對比度與品牌一致性可以被單測驗證。
 *
 * 深色主題刻意與 docs/slides/ 三份簡報同一組色(深藍 #0b1220 × 香檳金 #c9a961):
 * 業務在客戶面前從簡報翻到平板時,不該有「換了一套產品」的斷裂感。
 * 改動時 src/components/showcase/theme.ts 與 .build/*.cjs 的 palette 要一起改。
 */
export type ColorScheme = {
  primary: string;      // 主色(金)
  background: string;   // 底層背景
  surface: string;      // 卡片／元件面
  foreground: string;   // 正文
  muted: string;        // 次要文字
  border: string;       // 分隔線／細框
  success: string;
  warning: string;
  error: string;
  cardShadow: string;
};

export const lightColors: ColorScheme = {
  primary: "#8A6A2F",    // 深金 — 白底上要壓得住,亮金會糊掉
  background: "#FFFFFF",
  surface: "#F8F5F0",
  foreground: "#1A1A1A",
  muted: "#5F5F5F",
  border: "#D1C7BD",
  success: "#2E7D32",
  warning: "#B26A00",
  error: "#D32F2F",
  cardShadow: "rgba(0,0,0,0.1)",
};

export const darkColors: ColorScheme = {
  primary: "#c9a961",    // 香檳金 — 與簡報同一支
  background: "#0b1220", // 深藍
  surface: "#13223d",    // 卡面
  foreground: "#e8edf7",
  muted: "#9fb0cc",
  border: "#24365c",
  success: "#5fbf8f",
  warning: "#e0b84d",
  error: "#d86060",
  cardShadow: "rgba(0,0,0,0.5)",
};
