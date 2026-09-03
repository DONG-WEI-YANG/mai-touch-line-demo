import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useOfflineStatus } from "@/hooks/use-offline-status";
import { offlineService } from "@/lib/offline";
import { getSyncStatusPresentation } from "@/lib/sync-status";

export function SyncStatusBanner({ language }: { language: "en" | "zh" }) {
  const colors = useColors();
  const snapshot = useOfflineStatus();
  const presentation = getSyncStatusPresentation(snapshot, language);
  const [retrying, setRetrying] = useState(false);
  if (!presentation.visible) return null;

  const toneColor = presentation.tone === "error"
    ? colors.error
    : presentation.tone === "active"
      ? colors.primary
      : colors.warning;

  const retry = async () => {
    setRetrying(true);
    try {
      await offlineService.retryAllFailed();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View
      accessibilityRole="summary"
      style={[styles.banner, { backgroundColor: `${toneColor}12`, borderColor: `${toneColor}55` }]}
    >
      <View style={[styles.icon, { backgroundColor: `${toneColor}20` }]}>
        {presentation.tone === "active"
          ? <ActivityIndicator size="small" color={toneColor} />
          : <IconSymbol name={presentation.tone === "error" ? "exclamationmark.triangle.fill" : "wifi"} size={17} color={toneColor} />}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>{presentation.title}</Text>
        <Text style={[styles.detail, { color: colors.muted }]}>{presentation.detail}</Text>
      </View>
      {presentation.canRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={language === "zh" ? "重試所有未送達變更" : "Retry all undelivered changes"}
          disabled={retrying}
          onPress={retry}
          style={({ pressed }) => [styles.retry, {
            borderColor: toneColor,
            opacity: pressed || retrying ? 0.6 : 1,
          }]}
        >
          <Text style={[styles.retryText, { color: toneColor }]}>{language === "zh" ? "全部重試" : "Retry all"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: 20, marginBottom: 10, borderWidth: 1, borderRadius: 12, padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  title: { fontSize: 12, fontWeight: "800" },
  detail: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  retry: { minHeight: 32, justifyContent: "center", borderWidth: 1, borderRadius: 9, paddingHorizontal: 9 },
  retryText: { fontSize: 10, fontWeight: "800" },
});
