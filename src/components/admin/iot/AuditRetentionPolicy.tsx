import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { 
  CLEANUP_PRESET_LABELS, 
  CLEANUP_PRESET_DESCRIPTIONS, 
  PRESET_HISTORY_ACTION_LABELS,
  CleanupAlertPreset,
  PresetHistoryAction
} from './types';

type AuditRetentionPolicyProps = {
  isRetentionLoading: boolean;
  cleanupAlertStatus: any;
  schedulerStatus: any;
  cleanupPolicyStatus: any;
  schedulerIntervalInput: string;
  setSchedulerIntervalInput: (v: string) => void;
  failureThresholdInput: string;
  setFailureThresholdInput: (v: string) => void;
  consecutiveFailureThresholdInput: string;
  setConsecutiveFailureThresholdInput: (v: string) => void;
  cleanupAlertPresets: any[];
  selectedCleanupPreset: CleanupAlertPreset | null;
  onApplyCleanupPreset: (preset: CleanupAlertPreset) => void;
  onToggleSchedulerEnabled: () => void;
  onApplySchedulerInterval: () => void;
  onApplyAlertThresholds: () => void;
  onRollbackCleanupPreset: () => void;
  onTogglePolicyLockMode: () => void;
  policyImportInput: string;
  setPolicyImportInput: (v: string) => void;
  onExportCleanupPolicy: () => void;
  onImportCleanupPolicy: () => void;
  cleanupPresetHistory: any[];
  isCleanupPresetHistoryLoading: boolean;
  effectiveRetentionDays?: number;
  effectiveMaxRecords?: number;
  retentionDaysInput: string;
  setRetentionDaysInput: (v: string) => void;
  maxRecordsInput: string;
  setMaxRecordsInput: (v: string) => void;
  onManualCleanup: () => void;
  cleanupErrorText: string;
  cleanupResultText: string;
};

export function AuditRetentionPolicy({
  isRetentionLoading,
  cleanupAlertStatus,
  schedulerStatus,
  cleanupPolicyStatus,
  schedulerIntervalInput,
  setSchedulerIntervalInput,
  failureThresholdInput,
  setFailureThresholdInput,
  consecutiveFailureThresholdInput,
  setConsecutiveFailureThresholdInput,
  cleanupAlertPresets,
  selectedCleanupPreset,
  onApplyCleanupPreset,
  onToggleSchedulerEnabled,
  onApplySchedulerInterval,
  onApplyAlertThresholds,
  onRollbackCleanupPreset,
  onTogglePolicyLockMode,
  policyImportInput,
  setPolicyImportInput,
  onExportCleanupPolicy,
  onImportCleanupPolicy,
  cleanupPresetHistory,
  isCleanupPresetHistoryLoading,
  effectiveRetentionDays,
  effectiveMaxRecords,
  retentionDaysInput,
  setRetentionDaysInput,
  maxRecordsInput,
  setMaxRecordsInput,
  onManualCleanup,
  cleanupErrorText,
  cleanupResultText,
}: AuditRetentionPolicyProps) {
  const colors = useColors();

  const cleanupAlertLevel = cleanupAlertStatus?.level ?? "normal";
  const cleanupAlertColor =
    cleanupAlertLevel === "critical"
      ? colors.error
      : cleanupAlertLevel === "warning"
        ? colors.warning
        : colors.success;

  return (
    <View style={styles.container}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>BATCH CONTROL AUDIT</Text>
      </View>

      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>審計資料保留策略</Text>
        
        {isRetentionLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            {cleanupAlertStatus && cleanupAlertStatus.level !== "normal" && (
              <View style={[styles.alertBox, { borderColor: cleanupAlertColor, backgroundColor: cleanupAlertColor + "15" }]}>
                <Text style={[styles.alertTitle, { color: cleanupAlertColor }]}>
                  {cleanupAlertStatus.level === "critical" ? "清理警報：CRITICAL" : "清理警報：WARNING"}
                </Text>
                <Text style={[styles.alertMeta, { color: colors.foreground }]}>{cleanupAlertStatus.message}</Text>
                <Text style={[styles.alertMeta, { color: colors.muted }]}>
                  24h 失敗 {cleanupAlertStatus.failedRuns} 次，連續失敗 {cleanupAlertStatus.consecutiveFailures} 次
                </Text>
                <Text style={[styles.alertMeta, { color: colors.muted }]}>
                  風險分數 {cleanupAlertStatus.riskScore}/100 • 建議預設 {CLEANUP_PRESET_LABELS[cleanupAlertStatus.recommendedPreset as CleanupAlertPreset]}
                </Text>
              </View>
            )}

            <View style={[styles.schedulerBox, { borderColor: colors.border }]}>
              <View style={styles.schedulerHeader}>
                <Text style={[styles.schedulerLabel, { color: colors.foreground }]}>自動清理</Text>
                <View style={[styles.statusBadge, { backgroundColor: schedulerStatus?.enabled ? colors.success + "20" : colors.warning + "20" }]}>
                  <Text style={[styles.statusText, { color: schedulerStatus?.enabled ? colors.success : colors.warning }]}>
                    {schedulerStatus?.enabled ? "ENABLED" : "PAUSED"}
                  </Text>
                </View>
              </View>

              <Text style={[styles.meta, { color: colors.muted }]}>下一次：{schedulerStatus?.nextRunAt ? new Date(schedulerStatus.nextRunAt).toLocaleString() : "--"}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>警報閾值：24h 失敗 {schedulerStatus?.failureThreshold ?? "--"} 次 / 連續 {schedulerStatus?.consecutiveFailureThreshold ?? "--"} 次</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>政策鎖定：{cleanupPolicyStatus?.lockMode ? "ON" : "OFF"}</Text>

              <View style={styles.inputRow}>
                <TextInput
                  value={schedulerIntervalInput}
                  onChangeText={setSchedulerIntervalInput}
                  keyboardType="number-pad"
                  placeholder="間隔(分)"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                />
                <TextInput
                  value={failureThresholdInput}
                  onChangeText={setFailureThresholdInput}
                  keyboardType="number-pad"
                  placeholder="24h 閾值"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                />
                <TextInput
                  value={consecutiveFailureThresholdInput}
                  onChangeText={setConsecutiveFailureThresholdInput}
                  keyboardType="number-pad"
                  placeholder="連續閾值"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {(cleanupAlertPresets.length > 0
                  ? cleanupAlertPresets.map((item) => item.preset as CleanupAlertPreset)
                  : (Object.keys(CLEANUP_PRESET_LABELS) as CleanupAlertPreset[])
                ).map((preset) => {
                  const isSelected = selectedCleanupPreset === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.chip, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary + "20" : colors.surface }]}
                      onPress={() => onApplyCleanupPreset(preset)}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? colors.primary : colors.muted }]}>{CLEANUP_PRESET_LABELS[preset]}</Text>
                      <Text style={[styles.chipMeta, { color: isSelected ? colors.primary : colors.muted }]}>{CLEANUP_PRESET_DESCRIPTIONS[preset]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.actionGrid}>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={onToggleSchedulerEnabled}>
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>{schedulerStatus?.enabled ? "暫停自動清理" : "啟用自動清理"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]} onPress={onApplySchedulerInterval}>
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>套用間隔</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.warning, backgroundColor: colors.warning + "10" }]} onPress={onApplyAlertThresholds}>
                  <Text style={[styles.actionBtnText, { color: colors.warning }]}>套用閾值</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.error, backgroundColor: colors.error + "10" }]} onPress={onRollbackCleanupPreset}>
                  <Text style={[styles.actionBtnText, { color: colors.error }]}>回退預設</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.muted, marginTop: 8 }]} onPress={onTogglePolicyLockMode}>
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>{cleanupPolicyStatus?.lockMode ? "解除政策鎖定" : "啟用政策鎖定"}</Text>
              </TouchableOpacity>

              <View style={styles.importExportSection}>
                <View style={styles.importExportHeader}>
                  <Text style={[styles.schedulerLabel, { color: colors.foreground }]}>政策匯入 / 匯出</Text>
                  <TouchableOpacity onPress={onExportCleanupPolicy} style={[styles.smallBtn, { borderColor: colors.primary }]}>
                    <Text style={[styles.smallBtnText, { color: colors.primary }]}>匯出簽名政策</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={policyImportInput}
                  onChangeText={setPolicyImportInput}
                  multiline
                  numberOfLines={4}
                  placeholder="貼上政策 JSON"
                  placeholderTextColor={colors.muted}
                  style={[styles.jsonInput, { borderColor: colors.border, color: colors.foreground }]}
                />
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10", marginTop: 8 }]} onPress={onImportCleanupPolicy}>
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>套用政策 JSON</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.historySection}>
                <Text style={[styles.schedulerLabel, { color: colors.foreground }]}>預設變更歷史</Text>
                {isCleanupPresetHistoryLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : cleanupPresetHistory.length === 0 ? (
                  <Text style={[styles.meta, { color: colors.muted }]}>尚無預設變更記錄</Text>
                ) : (
                  cleanupPresetHistory.map((item) => (
                    <View key={item.id} style={styles.historyItem}>
                      <Text style={[styles.meta, { color: colors.foreground }]}>
                        {PRESET_HISTORY_ACTION_LABELS[item.action as PresetHistoryAction]} • {item.preset ? CLEANUP_PRESET_LABELS[item.preset as CleanupAlertPreset] : "Custom"}
                      </Text>
                      <Text style={[styles.meta, { color: colors.muted }]}>
                        {new Date(item.timestamp).toLocaleString()} • {item.actorOpenId || "system"}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={styles.manualSection}>
              <Text style={[styles.meta, { color: colors.muted }]}>目前策略：保留 {effectiveRetentionDays ?? "--"} 天，最多 {effectiveMaxRecords ?? "--"} 筆。</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={retentionDaysInput}
                  onChangeText={setRetentionDaysInput}
                  keyboardType="number-pad"
                  placeholder="天數"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                />
                <TextInput
                  value={maxRecordsInput}
                  onChangeText={setMaxRecordsInput}
                  keyboardType="number-pad"
                  placeholder="筆數"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                />
                <TouchableOpacity style={[styles.actionBtn, { flex: 2, borderColor: colors.primary, backgroundColor: colors.primary + "10" }]} onPress={onManualCleanup}>
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>手動清理</Text>
                </TouchableOpacity>
              </View>
              {cleanupErrorText ? <Text style={[styles.errorText, { color: colors.error }]}>{cleanupErrorText}</Text> : null}
              {cleanupResultText ? <Text style={[styles.resultText, { color: colors.muted }]}>{cleanupResultText}</Text> : null}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionTitleRow: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  box: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 12 },
  title: { fontSize: 15, fontWeight: "800" },
  alertBox: { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4 },
  alertTitle: { fontSize: 12, fontWeight: "900" },
  alertMeta: { fontSize: 11, fontWeight: "600" },
  schedulerBox: { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 8 },
  schedulerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  schedulerLabel: { fontSize: 13, fontWeight: "800" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: "800" },
  meta: { fontSize: 11, fontWeight: "600" },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontWeight: "700" },
  chipRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 100 },
  chipText: { fontSize: 12, fontWeight: "700" },
  chipMeta: { fontSize: 10, fontWeight: "500", marginTop: 2 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flex: 1, minWidth: '45%', borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  importExportSection: { marginTop: 12, gap: 8 },
  importExportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  smallBtnText: { fontSize: 10, fontWeight: "700" },
  jsonInput: { borderWidth: 1.5, borderRadius: 8, padding: 10, fontSize: 11, minHeight: 80, textAlignVertical: 'top' },
  historySection: { marginTop: 12, gap: 6, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  historyItem: { paddingVertical: 4 },
  manualSection: { marginTop: 12, gap: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  errorText: { fontSize: 11, fontWeight: "700" },
  resultText: { fontSize: 11, fontWeight: "600" },
});
