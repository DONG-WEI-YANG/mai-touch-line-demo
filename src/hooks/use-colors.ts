/**
 * useColors — 優先使用已保存的裝置偏好，未設定時跟隨系統色彩。
 *
 * 色票本身住在 color-palettes.ts(純資料,不 import react-native),對比度與
 * 品牌一致性由 tests/showcase-theme.test.ts 驗證。
 */
import { useThemePreference } from "./use-theme-preference";

import { darkColors, lightColors, type ColorScheme } from "./color-palettes";

export type { ColorScheme };
export { darkColors, lightColors };

export function useColors(): ColorScheme {
  const { scheme: colorScheme } = useThemePreference();
  return colorScheme === "dark" ? darkColors : lightColors;
}
