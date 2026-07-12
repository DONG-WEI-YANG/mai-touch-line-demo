import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';

type DispatchHistoryProps = {
  dispatchHistory: any[];
  isLoading: boolean;
  showFallbackAlert: boolean;
};

export function DispatchHistory({ dispatchHistory, isLoading, showFallbackAlert }: DispatchHistoryProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>RECENT DISPATCH HISTORY</Text>
        {showFallbackAlert && (
          <View style={styles.warningTag}>
            <Text style={styles.warningTagText}>FALLBACK SPIKE</Text>
          </View>
        )}
      </View>

      <View style={[styles.historyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : dispatchHistory.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.muted }]}>No dispatch activity yet</Text>
        ) : (
          dispatchHistory.map((entry) => (
            <View key={entry.id} style={[styles.historyItem, { borderBottomColor: colors.border }]}>
              <View style={[styles.historyIcon, { backgroundColor: entry.result.commandDispatched ? colors.success + "20" : colors.warning + "20" }]}>
                <IconSymbol
                  name={entry.result.commandDispatched ? "checkmark.circle.fill" : "arrow.clockwise"}
                  size={14}
                  color={entry.result.commandDispatched ? colors.success : colors.warning}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyTitle, { color: colors.foreground }]}>
                  {entry.input.deviceName || `Device #${entry.input.deviceId}`} • {entry.input.status.toUpperCase()}
                </Text>
                <Text style={[styles.historyMeta, { color: colors.muted }]}>
                  {new Date(entry.timestamp).toLocaleTimeString()} • {entry.durationMs}ms • {entry.adapterResolved || "none"}
                </Text>
              </View>
              <Text style={[styles.historyTag, { color: entry.result.commandDispatched ? colors.success : colors.warning }]}>
                {entry.result.commandDispatched ? "SENT" : "FALLBACK"}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  warningTag: {
    backgroundColor: "#ED6C02",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warningTagText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },
  historyBox: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 4,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  historyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  historyMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  historyTag: {
    fontSize: 10,
    fontWeight: "800",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 12,
    fontWeight: "600",
  },
});
