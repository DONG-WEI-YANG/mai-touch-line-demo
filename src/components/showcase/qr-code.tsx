/**
 * QR 圖 —— 展示情境 3「客戶用自己的手機就能試」。
 *
 * 用 react-native-svg 直接畫格子,不引外部 QR 元件:矩陣由 toQrMatrix 產生並
 * 已被單測釘死,這裡只負責把 1 畫成方塊。安靜區(quiet zone)必須留,否則
 * 深色背景會讓相機辨識不到 —— 這是現場最容易踩的一個坑。
 */
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { toQrMatrix } from "@/lib/qr-matrix";

import { SHOWCASE_COLORS as C } from "./theme";

const QUIET_ZONE = 2;

export function ShowcaseQrCode({
  value,
  size = 200,
  caption,
}: {
  value: string;
  size?: number;
  caption?: string;
}) {
  const matrix = useMemo(() => {
    try {
      return toQrMatrix(value);
    } catch {
      return [];
    }
  }, [value]);

  if (matrix.length === 0) {
    return (
      <View style={[styles.fallback, { width: size, height: size }]}>
        <Text style={styles.fallbackText}>無法產生 QR</Text>
      </View>
    );
  }

  const cells = matrix.length + QUIET_ZONE * 2;

  return (
    <View style={styles.wrap}>
      {/* 白底不是裝飾 —— 相機需要高對比與安靜區才掃得到。 */}
      <View style={[styles.plate, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${cells} ${cells}`}>
          <Rect x={0} y={0} width={cells} height={cells} fill="#ffffff" />
          {matrix.map((row, y) =>
            row.map((bit, x) =>
              bit ? (
                <Rect
                  key={`${x}-${y}`}
                  x={x + QUIET_ZONE}
                  y={y + QUIET_ZONE}
                  width={1}
                  height={1}
                  fill="#0b1220"
                />
              ) : null,
            ),
          )}
        </Svg>
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 12 },
  plate: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
  },
  caption: { color: C.muted, fontSize: 12, textAlign: "center", lineHeight: 18 },
  fallback: {
    backgroundColor: C.cardDeep,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: { color: C.faint, fontSize: 12 },
});
