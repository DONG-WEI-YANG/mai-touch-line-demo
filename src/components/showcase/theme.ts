/**
 * 展示模式的視覺 token —— 與 docs/slides/ 三份簡報同一組色票。
 *
 * 業務在客戶面前從簡報翻到平板時,不該有「換了一套產品」的斷裂感。這裡的
 * 數值直接對應 .build/*.cjs 裡的 palette,改動時兩邊要一起改。
 *
 * 展示頁固定深色 —— 接待中心的燈光環境是暖黃聚光,深底金字最耐看,也最像
 * 精品建案的銷售物料;所以這裡不跟隨系統的淺色/深色偏好。
 */
export const SHOWCASE_COLORS = {
  /** 底層深藍 */
  base: "#0b1220",
  /** 卡面 */
  card: "#13223d",
  /** 卡面（更深，用於右欄事件流） */
  cardDeep: "#0e1a30",
  /** 分隔線／細框 */
  line: "#24365c",
  /** 香檳金 —— 主 accent */
  gold: "#c9a961",
  /** 次要金,用於小標與輔助資訊 */
  goldSoft: "#d9c48f",
  /** 正文 */
  paper: "#e8edf7",
  /** 次要文字 */
  muted: "#9fb0cc",
  /** 更淡的說明文字 */
  faint: "#6c7f9e",
  /** 狀態色 */
  live: "#5fbf8f",
  warn: "#e0b84d",
  danger: "#d86060",
} as const;

export const SHOWCASE_RADIUS = { card: 18, chip: 999, tile: 14 } as const;

/** 事件流的語意色 —— 對應 ShowcaseEvent["tone"]。 */
export const TONE_COLOR: Record<"info" | "success" | "warning", string> = {
  info: SHOWCASE_COLORS.muted,
  success: SHOWCASE_COLORS.live,
  warning: SHOWCASE_COLORS.warn,
};

/**
 * 展示頁專用的 ColorScheme —— 傳給共用元件(例如 VoiceBookingPanel)當色票覆寫。
 *
 * 需要它的原因:展示頁固定深色,但共用元件預設跟隨系統主題。業務的平板只要
 * 設在淺色模式,深藍頁面裡就會插一張米白卡片。固定主題的頁面不能嵌入會自己
 * 決定顏色的元件。
 */
export const SHOWCASE_COLOR_SCHEME = {
  primary: SHOWCASE_COLORS.gold,
  background: SHOWCASE_COLORS.base,
  surface: SHOWCASE_COLORS.cardDeep,
  foreground: SHOWCASE_COLORS.paper,
  muted: SHOWCASE_COLORS.muted,
  border: SHOWCASE_COLORS.line,
  success: SHOWCASE_COLORS.live,
  warning: SHOWCASE_COLORS.warn,
  error: SHOWCASE_COLORS.danger,
  cardShadow: "rgba(0,0,0,0.5)",
} as const;
