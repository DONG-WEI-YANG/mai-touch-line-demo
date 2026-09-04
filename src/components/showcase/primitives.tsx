/**
 * 展示模式的視覺 primitives。
 *
 * 刻意與 App 其餘部分的 useColors() 脫鉤:展示頁固定深藍×金,不跟隨系統主題,
 * 因為它的觀眾不是住戶而是站在接待中心的客戶,視覺要接得上簡報。
 */
import React from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle, type StyleProp } from "react-native";

import { SHOWCASE_COLORS as C, SHOWCASE_RADIUS as R } from "./theme";

/** 金色細框半透明卡片 —— 簡報上每一張卡的同一個語彙。 */
export function ShowcaseCard({
  children,
  style,
  accent,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 左緣的彩色書籤,用來標示欄位歸屬。 */
  accent?: string;
}) {
  return (
    <View style={[styles.card, style]}>
      {accent ? <View style={[styles.accentRail, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  );
}

/** 全大寫細字小標 + 中文標題,簡報頁首的縮小版。 */
export function ShowcaseHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
}) {
  return (
    <View>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

/** 狀態膠囊 —— 「已連線 / 模擬設備」這類必須一眼看到的標示。 */
export function StatusPill({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "live" | "warn" | "muted" | "gold";
}) {
  const color =
    tone === "live" ? C.live : tone === "warn" ? C.warn : tone === "gold" ? C.gold : C.muted;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

/** 主要動作按鈕。金底深字 = 可按;描邊 = 次要;變暗 = 不可按。 */
export function ShowcaseButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextGhost]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 分節細線 + 標籤,取代粗重的分隔標題。 */
export function ShowcaseDivider({ label }: { label?: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      {label ? <Text style={styles.dividerLabel}>{label}</Text> : null}
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    overflow: "hidden",
  },
  accentRail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  eyebrow: {
    color: C.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  title: { color: C.paper, fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  sub: { color: C.muted, fontSize: 13, marginTop: 6, lineHeight: 20 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: R.chip,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  button: {
    borderRadius: R.chip,
    paddingHorizontal: 22,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonPrimary: { backgroundColor: C.gold, borderColor: C.gold },
  buttonGhost: { backgroundColor: "transparent", borderColor: C.line },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.8 },
  buttonTextPrimary: { color: C.base },
  buttonTextGhost: { color: C.goldSoft },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.line },
  dividerLabel: { color: C.faint, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
});
