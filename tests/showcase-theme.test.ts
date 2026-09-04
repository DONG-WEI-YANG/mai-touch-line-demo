/**
 * 深色主題與簡報同一套品牌色。
 *
 * 這裡測的不是「好不好看」,而是可驗證的兩件事:
 *  1. token 完整,沒有漏掉任何一個消費端會讀的欄位
 *  2. 文字對比度過得了 WCAG AA —— 接待中心是暖黃聚光環境,對比不足在現場
 *     比在螢幕前更明顯
 */
import { describe, expect, it } from "vitest";

import { SHOWCASE_COLORS } from "../src/components/showcase/theme";
import { darkColors, lightColors } from "../src/hooks/color-palettes";

/** WCAG 相對亮度。 */
function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const REQUIRED_TOKENS = [
  "primary", "background", "surface", "foreground",
  "muted", "border", "success", "warning", "error", "cardShadow",
] as const;

describe("色票完整性", () => {
  it("深色與淺色都齊備所有 token", () => {
    for (const token of REQUIRED_TOKENS) {
      expect(darkColors[token], `dark.${token}`).toBeTruthy();
      expect(lightColors[token], `light.${token}`).toBeTruthy();
    }
  });
});

describe("深色主題對比度", () => {
  it("正文對背景達 WCAG AA(4.5:1)", () => {
    expect(contrast(darkColors.foreground, darkColors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("正文對卡片面達 WCAG AA", () => {
    expect(contrast(darkColors.foreground, darkColors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("次要文字對背景至少達大字級標準(3:1)", () => {
    expect(contrast(darkColors.muted, darkColors.background)).toBeGreaterThanOrEqual(3);
  });

  it("金色 accent 對背景可辨識", () => {
    expect(contrast(darkColors.primary, darkColors.background)).toBeGreaterThanOrEqual(3);
  });
});

describe("與簡報色票一致", () => {
  it("深色背景就是簡報的深藍", () => {
    expect(darkColors.background.toLowerCase()).toBe(SHOWCASE_COLORS.base.toLowerCase());
  });

  it("主色就是簡報的香檳金", () => {
    expect(darkColors.primary.toLowerCase()).toBe(SHOWCASE_COLORS.gold.toLowerCase());
  });

  it("卡片面就是簡報的卡面色", () => {
    expect(darkColors.surface.toLowerCase()).toBe(SHOWCASE_COLORS.card.toLowerCase());
  });
});
