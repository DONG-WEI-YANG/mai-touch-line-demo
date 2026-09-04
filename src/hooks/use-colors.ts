/**
 * useColors — 依系統的淺色/深色偏好回傳色票。
 *
 * 色票本身住在 color-palettes.ts(純資料,不 import react-native),對比度與
 * 品牌一致性由 tests/showcase-theme.test.ts 驗證。
 */
import { useColorScheme } from "react-native";

import { darkColors, lightColors, type ColorScheme } from "./color-palettes";

export type { ColorScheme };
export { darkColors, lightColors };

export function useColors(): ColorScheme {
  const colorScheme = useColorScheme();
  return colorScheme === "dark" ? darkColors : lightColors;
}
