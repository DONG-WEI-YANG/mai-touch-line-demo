/**
 * 品牌色設定。
 *
 * 目前沒有執行期消費端 —— App 實際讀的是 src/hooks/color-palettes.ts。
 * 這份保留作為設定層的對照,深色值與 color-palettes.ts、
 * src/components/showcase/theme.ts 及 docs/slides 簡報同一組(深藍 × 香檳金),
 * 三處改動要同步,別讓後人讀到兩套互相矛盾的品牌色。
 *
 * @type {const}
 */
const themeColors = {
  primary: { light: '#8A6A2F', dark: '#c9a961' },
  background: { light: '#FFFFFF', dark: '#0b1220' },
  surface: { light: '#F8F5F0', dark: '#13223d' },
  foreground: { light: '#1A1A1A', dark: '#e8edf7' },
  muted: { light: '#5F5F5F', dark: '#9fb0cc' },
  border: { light: '#D1C7BD', dark: '#24365c' },
  success: { light: '#2E7D32', dark: '#5fbf8f' },
  warning: { light: '#B26A00', dark: '#e0b84d' },
  error: { light: '#D32F2F', dark: '#d86060' },
};

module.exports = { themeColors };
