import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { 
  DEVICE_TYPE_LABELS, 
  AUDIT_RESULT_LABELS, 
  PIN_VERIFICATION_LABELS, 
  RISK_LEVEL_LABELS,
  BulkDeviceType,
  AuditResult,
  PinVerificationState,
  RiskLevel,
  BulkAuditItem,
  BulkAuditStats
} from './types';

type BulkAuditLogsProps = {
  bulkAuditItems: BulkAuditItem[];
  isLoading: boolean;
  bulkAuditStats?: BulkAuditStats;
  amenityNameMap: Map<number, string>;
};

export function BulkAuditLogs({ bulkAuditItems, isLoading, bulkAuditStats, amenityNameMap }: BulkAuditLogsProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.title, { color: colors.muted }]}>BATCH CONTROL AUDIT LOGS</Text>
        {bulkAuditStats && (
          <Text style={[styles.summaryText, { color: colors.muted }]}>
            24h {bulkAuditStats.last24hCount} • 成功 {bulkAuditStats.successCount} • 拒絕 {bulkAuditStats.rejectedCount}
          </Text>
        )}
      </View>

      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : bulkAuditItems.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.muted }]}>尚無批次控制審計紀錄</Text>
        ) : (
          bulkAuditItems.map((entry) => {
            const riskColor =
              entry.riskLevel === "high"
                ? colors.error
                : entry.riskLevel === "medium"
                  ? colors.warning
                  : colors.success;
            
            const resultColor =
              entry.result === "success"
                ? colors.success
                : entry.result === "rejected"
                  ? colors.warning
                  : colors.error;

            const amenityLabel = String(
              amenityNameMap.get(entry.amenityId) || `Amenity #${entry.amenityId}`,
            );

            return (
              <View key={entry.id} style={[styles.logItem, { borderBottomColor: colors.border }]}>
                <View style={styles.logHeader}>
                  <Text style={[styles.logTitle, { color: colors.foreground }]}>
                    {amenityLabel} • {DEVICE_TYPE_LABELS[entry.deviceType as BulkDeviceType]} • {entry.status.toUpperCase()}
                  </Text>
                  <Text style={[styles.resultTag, { color: resultColor }]}>
                    {AUDIT_RESULT_LABELS[entry.result as AuditResult]}
                  </Text>
                </View>
                
                <Text style={[styles.logMeta, { color: colors.muted }]}>
                  {new Date(entry.timestamp).toLocaleString()} • 目標 {entry.targetDeviceCount} 台 • PIN {PIN_VERIFICATION_LABELS[entry.pinVerification as PinVerificationState]}
                </Text>
                
                <Text style={[styles.logMeta, { color: colors.muted }]}>
                  風險：<Text style={{ color: riskColor }}>{RISK_LEVEL_LABELS[entry.riskLevel as RiskLevel]}</Text>（{entry.requiredPermissionTier}） • 發送 {entry.dispatchedCount} • fallback {entry.fallbackCount}
                </Text>
                
                {entry.errorMessage && (
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {entry.errorCode ? `${entry.errorCode}: ` : ""}{entry.errorMessage}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  summaryText: { fontSize: 10, fontWeight: "600" },
  box: { borderRadius: 16, borderWidth: 1.5, paddingVertical: 4 },
  logItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 4 },
  logHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  logTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
  resultTag: { fontSize: 11, fontWeight: "800" },
  logMeta: { fontSize: 11, fontWeight: "600" },
  errorText: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  emptyText: { textAlign: "center", paddingVertical: 24, fontSize: 12, fontWeight: "600" },
});
