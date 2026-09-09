import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { CLEANUP_SOURCE_LABELS, CleanupRunSource } from './types';

type AuditCleanupReportsProps = {
  cleanupRunReports: any[];
  isLoading: boolean;
  cleanupRunSummary: any;
};

export function AuditCleanupReports({ cleanupRunReports, isLoading, cleanupRunSummary }: AuditCleanupReportsProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>自動清理執行報告</Text>
        {cleanupRunSummary && (
          <Text style={[styles.summaryText, { color: colors.muted }]}>
            24h {cleanupRunSummary.totalRuns} 次 • 失敗 {cleanupRunSummary.failedRuns} • 刪除 {cleanupRunSummary.totalDeleted}
          </Text>
        )}
      </View>

      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : cleanupRunReports.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.muted }]}>尚無自動清理執行紀錄</Text>
        ) : (
          cleanupRunReports.map((report) => {
            const reportColor = report.success ? colors.success : colors.error;
            return (
              <View key={report.id} style={[styles.reportItem, { borderBottomColor: colors.border }]}>
                <View style={styles.reportHeader}>
                  <Text style={[styles.reportTitle, { color: colors.foreground }]}>
                    {CLEANUP_SOURCE_LABELS[report.source as CleanupRunSource]} • {report.success ? "成功" : "失敗"}
                  </Text>
                  <Text style={[styles.reportStatus, { color: reportColor }]}>
                    {report.success ? "OK" : "ERR"}
                  </Text>
                </View>
                <Text style={[styles.reportMeta, { color: colors.muted }]}>
                  {new Date(report.timestamp).toLocaleString()} • {report.durationMs}ms
                </Text>
                <Text style={[styles.reportMeta, { color: colors.muted }]}>
                  刪除 {report.result?.totalDeleted ?? 0} 筆（天數 {report.result?.deletedByDays ?? 0}、筆數 {report.result?.deletedByCount ?? 0}）
                </Text>
                {report.errorMessage && (
                  <Text style={[styles.errorText, { color: colors.error }]}>{report.errorMessage}</Text>
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
  title: { fontSize: 13, fontWeight: "800" },
  summaryText: { fontSize: 10, fontWeight: "600" },
  box: { borderRadius: 16, borderWidth: 1.5, paddingVertical: 4 },
  reportItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportTitle: { fontSize: 12, fontWeight: "700" },
  reportStatus: { fontSize: 10, fontWeight: "800" },
  reportMeta: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  errorText: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  emptyText: { textAlign: "center", paddingVertical: 24, fontSize: 12, fontWeight: "600" },
});
