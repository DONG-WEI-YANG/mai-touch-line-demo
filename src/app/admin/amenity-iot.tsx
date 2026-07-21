import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { AdminHeader } from "@/components/admin/admin-ui";
import { parseError } from "@/lib/error-utils";

// IoT Components
import { 
  RISK_LEVEL_LABELS, 
  AmenityFilterOption, 
  DeviceTypeOption, 
  BulkDeviceType, 
  CleanupAlertPreset,
  Amenity,
  Device,
  PendingBulkAction
} from "./iot-components/types";
import { GatewayHealthCard } from "./iot-components/GatewayHealthCard";
import { BulkControlPanel } from "./iot-components/BulkControlPanel";
import { DeviceList } from "./iot-components/DeviceList";
import { DispatchHistory } from "./iot-components/DispatchHistory";
import { AuditRetentionPolicy } from "./iot-components/AuditRetentionPolicy";
import { AuditCleanupReports } from "./iot-components/AuditCleanupReports";
import { BulkAuditLogs } from "./iot-components/BulkAuditLogs";

export default function AmenityIotScreen() {
  const colors = useColors();
  
  // Constants
  const HARDWARE_POLLING_MS = 30000;
  const FALLBACK_SPIKE_WINDOW = 8;
  const FALLBACK_SPIKE_MIN_COUNT = 3;
  const FALLBACK_SPIKE_MIN_RATE = 0.5;
  const ALERT_SNOOZE_MS = 10 * 60 * 1000;
  const ALERT_STATE_KEY = "admin.hardware.alertState.amenityIot";

  // Local State
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceTypeOption>("all");
  const [selectedAmenityId, setSelectedAmenityId] = useState<AmenityFilterOption>("all");
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);
  const [acknowledgedSignature, setAcknowledgedSignature] = useState<string>("");
  const [bulkResultText, setBulkResultText] = useState<string>("");
  const [bulkErrorText, setBulkErrorText] = useState<string>("");
  const [pinValue, setPinValue] = useState<string>("");
  const [pinErrorText, setPinErrorText] = useState<string>("");
  const [isPinPanelVisible, setIsPinPanelVisible] = useState<boolean>(false);
  const [retentionDaysInput, setRetentionDaysInput] = useState<string>("");
  const [maxRecordsInput, setMaxRecordsInput] = useState<string>("");
  const [schedulerIntervalInput, setSchedulerIntervalInput] = useState<string>("");
  const [failureThresholdInput, setFailureThresholdInput] = useState<string>("");
  const [consecutiveFailureThresholdInput, setConsecutiveFailureThresholdInput] = useState<string>("");
  const [policyImportInput, setPolicyImportInput] = useState<string>("");
  const [cleanupResultText, setCleanupResultText] = useState<string>("");
  const [cleanupErrorText, setCleanupErrorText] = useState<string>("");
  const [pendingBulkAction, setPendingBulkAction] = useState<PendingBulkAction>(null);

  // tRPC Hooks
  const { data: devices = [] as Device[], isLoading, refetch } = trpc.admin.amenityDevices.useQuery({});
  const { data: amenities = [] as Amenity[] } = trpc.amenities.list.useQuery();
  const { data: gatewayHealth, isLoading: isGatewayHealthLoading, refetch: refetchGatewayHealth } = trpc.admin.hardwareGatewayHealth.useQuery(undefined, { refetchInterval: HARDWARE_POLLING_MS });
  const { data: dispatchHistory = [], isLoading: isDispatchLoading, refetch: refetchDispatchHistory } = trpc.admin.hardwareDispatchHistory.useQuery({ limit: FALLBACK_SPIKE_WINDOW }, { refetchInterval: HARDWARE_POLLING_MS });
  const { data: bulkAuditData, isLoading: isBulkAuditLoading, refetch: refetchBulkAuditLogs } = trpc.admin.bulkControlAuditLogs.useQuery({
    limit: 12,
    amenityId: selectedAmenityId === "all" ? undefined : selectedAmenityId,
  });
  const { data: retentionData, isLoading: isRetentionLoading, refetch: refetchRetentionPolicy } = trpc.admin.auditRetentionPolicy.useQuery();
  const { data: schedulerStatus, refetch: refetchSchedulerStatus } = trpc.admin.auditCleanupSchedulerStatus.useQuery();
  const { data: cleanupPolicyStatus, refetch: refetchCleanupPolicyStatus } = trpc.admin.auditCleanupPolicyStatus.useQuery();
  const { data: cleanupRunReports = [], isLoading: isCleanupRunReportsLoading, refetch: refetchCleanupRunReports } = trpc.admin.auditCleanupRunReports.useQuery({ limit: 10 });
  const { data: cleanupRunSummary, refetch: refetchCleanupRunSummary } = trpc.admin.auditCleanupRunSummary.useQuery({ windowHours: 24 });
  const { data: cleanupAlertStatus, refetch: refetchCleanupAlertStatus } = trpc.admin.auditCleanupAlertStatus.useQuery({ windowHours: 24 });
  const { data: cleanupAlertPresets = [] } = trpc.admin.auditCleanupAlertPresets.useQuery();
  const { data: cleanupPresetHistory = [], isLoading: isCleanupPresetHistoryLoading, refetch: refetchCleanupPresetHistory } = trpc.admin.auditCleanupPresetHistory.useQuery({ limit: 8 });

  // Mutations
  const updateDeviceMutation = trpc.admin.controlDevice.useMutation();
  const bulkControlMutation = trpc.admin.bulkControlDevices.useMutation();
  const runAuditCleanupNowMutation = trpc.admin.runAuditCleanupNow.useMutation();
  const setAuditCleanupSchedulerMutation = trpc.admin.setAuditCleanupScheduler.useMutation();
  const applyCleanupAlertPresetMutation = trpc.admin.applyAuditCleanupAlertPreset.useMutation();
  const setCleanupPolicyLockModeMutation = trpc.admin.setAuditCleanupPolicyLockMode.useMutation();
  const importCleanupPolicyMutation = trpc.admin.importAuditCleanupPolicy.useMutation();
  const rollbackCleanupPresetMutation = trpc.admin.rollbackAuditCleanupAlertPreset.useMutation();
  
  const trpcUtils = trpc.useUtils();

  // Memos
  const amenityNameMap = useMemo(() => new Map<number, string>(amenities.map((a: Amenity) => [a.id, a.name])), [amenities]);
  const availableDeviceTypes = useMemo(() => {
    const types = new Set<DeviceTypeOption>(["all"]);
    devices.forEach((d: Device) => types.add(d.type as DeviceTypeOption));
    return Array.from(types);
  }, [devices]);

  const selectedTargetDevices = useMemo(() => {
    return devices.filter((d: Device) => {
      const amenityMatch = selectedAmenityId === "all" || d.amenityId === selectedAmenityId;
      const typeMatch = selectedDeviceType === "all" || d.type === selectedDeviceType;
      return amenityMatch && typeMatch;
    });
  }, [devices, selectedAmenityId, selectedDeviceType]);

  const recentFallbackCount = useMemo(() => dispatchHistory.filter(e => e.result.fallbackUsed).length, [dispatchHistory]);
  const recentFallbackRate = dispatchHistory.length > 0 ? recentFallbackCount / dispatchHistory.length : 0;
  const isFallbackSpike = recentFallbackCount >= FALLBACK_SPIKE_MIN_COUNT && recentFallbackRate >= FALLBACK_SPIKE_MIN_RATE;
  
  const spikeSignature = useMemo(() => 
    dispatchHistory.slice(0, FALLBACK_SPIKE_WINDOW).map(e => `${e.id}:${e.result.fallbackUsed ? 1 : 0}`).join("|"),
    [dispatchHistory]
  );

  const isSnoozed = snoozedUntil > Date.now();
  const isAcknowledged = acknowledgedSignature !== "" && acknowledgedSignature === spikeSignature;
  const showFallbackAlert = isFallbackSpike && !isSnoozed && !isAcknowledged;
  
  const alertStatusLabel = showFallbackAlert ? "ACTIVE" : isSnoozed ? "SNOOZED" : isAcknowledged ? "ACK" : "NORMAL";
  const alertStatusColor = showFallbackAlert ? colors.error : isSnoozed ? colors.warning : isAcknowledged ? colors.success : colors.muted;

  const isBulkActionDisabled = bulkControlMutation.isPending || selectedAmenityId === "all" || selectedDeviceType === "all" || selectedTargetDevices.length === 0;

  const lastAlertUpdateText = dispatchHistory[0]?.timestamp 
    ? `Updated ${new Date(dispatchHistory[0].timestamp).toLocaleTimeString()}`
    : "Updated --";

  const selectedCleanupPreset: CleanupAlertPreset | null = useMemo(() => {
    if (!schedulerStatus) return null;
    const matched = cleanupAlertPresets.find(p => 
      p.failureThreshold === schedulerStatus.failureThreshold && 
      p.consecutiveFailureThreshold === schedulerStatus.consecutiveFailureThreshold
    );
    return (matched?.preset as CleanupAlertPreset) ?? null;
  }, [cleanupAlertPresets, schedulerStatus]);

  // Effects
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ALERT_STATE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setSnoozedUntil(parsed.snoozedUntil || 0);
        setAcknowledgedSignature(parsed.acknowledgedSignature || "");
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    if (!retentionData?.policy) return;
    setRetentionDaysInput(String(retentionData.policy.retentionDays));
    setMaxRecordsInput(String(retentionData.policy.maxRecords));
  }, [retentionData]);

  useEffect(() => {
    if (!schedulerStatus) return;
    setSchedulerIntervalInput(String(schedulerStatus.intervalMinutes));
    setFailureThresholdInput(String(schedulerStatus.failureThreshold));
    setConsecutiveFailureThresholdInput(String(schedulerStatus.consecutiveFailureThreshold));
  }, [schedulerStatus]);

  useEffect(() => {
    if (!cleanupPolicyStatus || policyImportInput !== "") return;
    setPolicyImportInput(JSON.stringify({
      enabled: cleanupPolicyStatus.enabled,
      intervalMinutes: cleanupPolicyStatus.intervalMinutes,
      failureThreshold: cleanupPolicyStatus.failureThreshold,
      consecutiveFailureThreshold: cleanupPolicyStatus.consecutiveFailureThreshold,
      lockMode: cleanupPolicyStatus.lockMode,
    }, null, 2));
  }, [cleanupPolicyStatus]);

  // Handlers
  const persistAlertState = useCallback(async (nextSnoozed: number, nextAck: string) => {
    setSnoozedUntil(nextSnoozed);
    setAcknowledgedSignature(nextAck);
    try {
      await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify({ snoozedUntil: nextSnoozed, acknowledgedSignature: nextAck }));
    } catch { /* ignore */ }
  }, []);

  const handleToggle = useCallback(async (deviceId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "on" || currentStatus === "active" ? "off" : "on";
    try {
      setBulkErrorText("");
      setBulkResultText("");
      await updateDeviceMutation.mutateAsync({ deviceId, status: nextStatus });
      await Promise.all([
        refetch(),
        refetchGatewayHealth(),
        refetchDispatchHistory(),
        refetchBulkAuditLogs(),
      ]);
    } catch (e: unknown) {
      setBulkErrorText(parseError(e, "Device control failed"));
    }
  }, [updateDeviceMutation, refetch, refetchGatewayHealth, refetchDispatchHistory, refetchBulkAuditLogs]);

  const executeBulkControl = useCallback(async (status: "on" | "off", amenityId: number, deviceType: BulkDeviceType, pin?: string) => {
    try {
      setBulkErrorText("");
      setPinErrorText("");
      const result = await bulkControlMutation.mutateAsync({ status, amenityId, deviceType, verificationPin: pin });
      setBulkResultText(`Applied ${status.toUpperCase()} • ${result.affected} devices • sent ${result.dispatchedCount} • fallback ${result.fallbackCount}`);
      setPinValue("");
      setPendingBulkAction(null);
      setIsPinPanelVisible(false);
      await Promise.all([refetch(), refetchGatewayHealth(), refetchDispatchHistory(), refetchBulkAuditLogs()]);
    } catch (e: unknown) {
      const msg = parseError(e);
      if (msg === "PIN_REQUIRED") {
        setIsPinPanelVisible(true);
        setPinErrorText("此操作為高風險，請輸入管理 PIN。");
      } else if (msg === "INVALID_PIN") {
        setIsPinPanelVisible(true);
        setPinErrorText("PIN 錯誤，請重新輸入。");
      } else {
        setBulkErrorText(msg || "Bulk control failed");
      }
    }
  }, [bulkControlMutation, refetch, refetchGatewayHealth, refetchDispatchHistory, refetchBulkAuditLogs]);

  const handleBulkControl = useCallback(async (status: "on" | "off") => {
    setBulkResultText("");
    if (selectedAmenityId === "all" || selectedDeviceType === "all") return;
    
    const deviceType = selectedDeviceType as BulkDeviceType;
    const amenityId = selectedAmenityId as number;
    
    try {
      const risk = await trpcUtils.admin.bulkControlRiskPreview.fetch({ amenityId, deviceType, status });
      const reasonText = risk.reasons.length > 0 ? risk.reasons.join("、") : "一般操作";
      
      Alert.alert("確認批次控制", `執行 ${status.toUpperCase()}（共 ${selectedTargetDevices.length} 台）。\n風險：${RISK_LEVEL_LABELS[risk.riskLevel]}`, [
        { text: "取消", style: "cancel" },
        { text: "確認執行", style: "destructive", onPress: async () => {
          if (risk.requiresPin) {
            setPendingBulkAction({ status, amenityId, deviceType, riskLevel: risk.riskLevel, requiredPermissionTier: risk.requiredPermissionTier, reasonText });
            setPinValue("");
            setIsPinPanelVisible(true);
          } else {
            await executeBulkControl(status, amenityId, deviceType);
          }
        }}
      ]);
    } catch (e: unknown) {
      setBulkErrorText(parseError(e, "無法取得風險評估"));
    }
  }, [selectedAmenityId, selectedDeviceType, trpcUtils.admin.bulkControlRiskPreview, selectedTargetDevices.length, executeBulkControl]);

  const handleManualCleanup = useCallback(async () => {
    const days = parseInt(retentionDaysInput, 10);
    const max = parseInt(maxRecordsInput, 10);
    if (isNaN(days) || isNaN(max) || days <= 0 || max <= 0) {
      setCleanupErrorText("請輸入有效的保留天數與最大筆數。");
      return;
    }
    try {
      setCleanupErrorText("");
      const result = await runAuditCleanupNowMutation.mutateAsync({ retentionDays: days, maxRecords: max });
      setCleanupResultText(`清理完成：刪除 ${result.totalDeleted} 筆，剩餘 ${result.afterCount} 筆。`);
      await Promise.all([refetchBulkAuditLogs(), refetchRetentionPolicy(), refetchSchedulerStatus(), refetchCleanupPolicyStatus(), refetchCleanupRunReports(), refetchCleanupRunSummary(), refetchCleanupAlertStatus()]);
    } catch (e: unknown) {
      setCleanupErrorText(parseError(e, "清理失敗"));
    }
  }, [retentionDaysInput, maxRecordsInput, runAuditCleanupNowMutation, refetchBulkAuditLogs, refetchRetentionPolicy, refetchSchedulerStatus, refetchCleanupPolicyStatus, refetchCleanupRunReports, refetchCleanupRunSummary, refetchCleanupAlertStatus]);

  return (
    <ScreenContainer edges={["top"]}>
      <AdminHeader 
        title="Amenity IoT Control" 
        subtitle={lastAlertUpdateText}
        rightElement={
          <View style={[styles.headerBadge, { backgroundColor: alertStatusColor + "20" }]}>
            <Text style={[styles.headerBadgeText, { color: alertStatusColor }]}>{alertStatusLabel}</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <GatewayHealthCard
          gatewayHealth={gatewayHealth}
          isLoading={isGatewayHealthLoading}
          showFallbackAlert={showFallbackAlert}
          onAcknowledge={() => persistAlertState(snoozedUntil, spikeSignature)}
          onSnooze={() => persistAlertState(Date.now() + ALERT_SNOOZE_MS, acknowledgedSignature)}
        />

        <BulkControlPanel
          amenities={amenities}
          availableDeviceTypes={availableDeviceTypes}
          selectedAmenityId={selectedAmenityId}
          setSelectedAmenityId={setSelectedAmenityId}
          selectedDeviceType={selectedDeviceType}
          setSelectedDeviceType={setSelectedDeviceType}
          targetCount={selectedTargetDevices.length}
          isBulkActionDisabled={isBulkActionDisabled}
          onBulkControl={handleBulkControl}
          bulkErrorText={bulkErrorText}
          bulkResultText={bulkResultText}
          isPinPanelVisible={isPinPanelVisible}
          pendingBulkAction={pendingBulkAction}
          pinValue={pinValue}
          setPinValue={setPinValue}
          pinErrorText={pinErrorText}
          onPinConfirm={() => executeBulkControl(pendingBulkAction.status, pendingBulkAction.amenityId, pendingBulkAction.deviceType as BulkDeviceType, pinValue)}
          onPinCancel={() => setIsPinPanelVisible(false)}
          isPending={bulkControlMutation.isPending}
        />

        <DeviceList
          devices={selectedTargetDevices}
          isLoading={isLoading}
          onToggle={handleToggle}
        />

        <DispatchHistory
          dispatchHistory={dispatchHistory}
          isLoading={isDispatchLoading}
          showFallbackAlert={showFallbackAlert}
        />

        <AuditRetentionPolicy
          isRetentionLoading={isRetentionLoading}
          cleanupAlertStatus={cleanupAlertStatus}
          schedulerStatus={schedulerStatus}
          cleanupPolicyStatus={cleanupPolicyStatus}
          schedulerIntervalInput={schedulerIntervalInput}
          setSchedulerIntervalInput={setSchedulerIntervalInput}
          failureThresholdInput={failureThresholdInput}
          setFailureThresholdInput={setFailureThresholdInput}
          consecutiveFailureThresholdInput={consecutiveFailureThresholdInput}
          setConsecutiveFailureThresholdInput={setConsecutiveFailureThresholdInput}
          cleanupAlertPresets={cleanupAlertPresets}
          selectedCleanupPreset={selectedCleanupPreset}
          onApplyCleanupPreset={(preset) => applyCleanupAlertPresetMutation.mutateAsync({ preset }).then(() => Promise.all([refetchSchedulerStatus(), refetchCleanupAlertStatus(), refetchCleanupPolicyStatus(), refetchCleanupPresetHistory()]))}
          onToggleSchedulerEnabled={() => setAuditCleanupSchedulerMutation.mutateAsync({ enabled: !schedulerStatus?.enabled }).then(() => refetchSchedulerStatus())}
          onApplySchedulerInterval={() => setAuditCleanupSchedulerMutation.mutateAsync({ intervalMinutes: parseInt(schedulerIntervalInput, 10) }).then(() => refetchSchedulerStatus())}
          onApplyAlertThresholds={() => setAuditCleanupSchedulerMutation.mutateAsync({ failureThreshold: parseInt(failureThresholdInput, 10), consecutiveFailureThreshold: parseInt(consecutiveFailureThresholdInput, 10) }).then(() => refetchSchedulerStatus())}
          onRollbackCleanupPreset={() => rollbackCleanupPresetMutation.mutateAsync().then(() => refetchSchedulerStatus())}
          onTogglePolicyLockMode={() => setCleanupPolicyLockModeMutation.mutateAsync({ lockMode: !cleanupPolicyStatus?.lockMode }).then(() => refetchCleanupPolicyStatus())}
          policyImportInput={policyImportInput}
          setPolicyImportInput={setPolicyImportInput}
          onExportCleanupPolicy={() => trpcUtils.admin.exportAuditCleanupPolicy.fetch().then(p => setPolicyImportInput(JSON.stringify(p, null, 2)))}
          onImportCleanupPolicy={() => importCleanupPolicyMutation.mutateAsync(JSON.parse(policyImportInput)).then(() => refetchCleanupPolicyStatus())}
          cleanupPresetHistory={cleanupPresetHistory}
          isCleanupPresetHistoryLoading={isCleanupPresetHistoryLoading}
          effectiveRetentionDays={retentionData?.policy.retentionDays}
          effectiveMaxRecords={retentionData?.policy.maxRecords}
          retentionDaysInput={retentionDaysInput}
          setRetentionDaysInput={setRetentionDaysInput}
          maxRecordsInput={maxRecordsInput}
          setMaxRecordsInput={setMaxRecordsInput}
          onManualCleanup={handleManualCleanup}
          cleanupErrorText={cleanupErrorText}
          cleanupResultText={cleanupResultText}
        />

        <AuditCleanupReports
          cleanupRunReports={cleanupRunReports}
          isLoading={isCleanupRunReportsLoading}
          cleanupRunSummary={cleanupRunSummary}
        />

        <BulkAuditLogs
          bulkAuditItems={bulkAuditData?.items ?? []}
          isLoading={isBulkAuditLoading}
          bulkAuditStats={bulkAuditData?.stats}
          amenityNameMap={amenityNameMap}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  headerBadgeText: { fontSize: 11, fontWeight: "800" },
  content: { padding: 16 },
});
