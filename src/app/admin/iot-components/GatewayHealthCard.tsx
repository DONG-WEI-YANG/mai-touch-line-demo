import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';

import { HardwareGatewayHealthInfo } from './types';

type GatewayHealthCardProps = {
  gatewayHealth?: HardwareGatewayHealthInfo;
  isLoading: boolean;
  showFallbackAlert: boolean;
  onAcknowledge: () => void;
  onSnooze: () => void;
};

export function GatewayHealthCard({
  gatewayHealth,
  isLoading,
  showFallbackAlert,
  onAcknowledge,
  onSnooze,
}: GatewayHealthCardProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>HARDWARE GATEWAY</Text>
        {showFallbackAlert && (
          <View style={styles.warningTag}>
            <Text style={styles.warningTagText}>FALLBACK SPIKE</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.foreground }]}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: gatewayHealth?.status === "healthy" ? colors.success + "20" : colors.warning + "20" }]}>
              <Text style={[styles.statusText, { color: gatewayHealth?.status === "healthy" ? colors.success : colors.warning }]}>
                {(gatewayHealth?.status || "unknown").toUpperCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.foreground }]}>Adapter</Text>
            <Text style={[styles.value, { color: colors.muted }]}>{gatewayHealth?.config?.adapterResolved || "none"}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.totalDispatches || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Dispatches</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.dispatchedCommands || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Sent</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.fallbackDispatches || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Fallbacks</Text>
            </View>
          </View>

          {showFallbackAlert && (
            <View style={styles.alertControls}>
              <TouchableOpacity style={[styles.alertButton, { borderColor: colors.border }]} onPress={onAcknowledge}>
                <Text style={[styles.alertButtonText, { color: colors.foreground }]}>Acknowledge</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.alertButton, { borderColor: colors.border }]} onPress={onSnooze}>
                <Text style={[styles.alertButtonText, { color: colors.foreground }]}>Snooze 10m</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
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
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: 'uppercase',
  },
  alertControls: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  alertButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  alertButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
