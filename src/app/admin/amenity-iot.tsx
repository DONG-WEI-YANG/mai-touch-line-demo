import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Alert, TextInput } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

const DEVICE_TYPE_OPTIONS = ["all", "light", "climate", "curtain", "security", "media", "power"] as const;
type DeviceTypeOption = (typeof DEVICE_TYPE_OPTIONS)[number];
type BulkDeviceType = Exclude<DeviceTypeOption, "all">;
type AmenityFilterOption = number | "all";
type RiskLevel = "low" | "medium" | "high";
type PermissionTier = "L1" | "L2" | "L3";
type AuditResult = "success" | "rejected" | "failed";
type PinVerificationState = "not_required" | "passed" | "missing" | "failed";
type CleanupRunSource = "scheduled" | "manual";
type CleanupAlertPreset = "conservative" | "balanced" | "aggressive";
type PresetHistoryAction = "apply_preset" | "rollback_preset" | "manual_threshold_update";

const DEVICE_TYPE_LABELS: Record<DeviceTypeOption, string> = {
  all: "All Types",
  light: "Light",
  climate: "Climate",
  curtain: "Curtain",
  security: "Security",
  media: "Media",
  power: "Power",
};

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "低風險",
  medium: "中風險",
  high: "高風險",
};

const AUDIT_RESULT_LABELS: Record<AuditResult, string> = {
  success: "成功",
  rejected: "拒絕",
  failed: "失敗",
};

const PIN_VERIFICATION_LABELS: Record<PinVerificationState, string> = {
  not_required: "免 PIN",
  passed: "驗證通過",
  missing: "未提供 PIN",
  failed: "PIN 驗證失敗",
};

const CLEANUP_SOURCE_LABELS: Record<CleanupRunSource, string> = {
  scheduled: "排程",
  manual: "手動",
};

const CLEANUP_PRESET_LABELS: Record<CleanupAlertPreset, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

const CLEANUP_PRESET_DESCRIPTIONS: Record<CleanupAlertPreset, string> = {
  conservative: "Fast escalation for strict operations",
  balanced: "Balanced escalation and signal quality",
  aggressive: "Escalate only with stronger failure signals",
};

const PRESET_HISTORY_ACTION_LABELS: Record<PresetHistoryAction, string> = {
  apply_preset: "套用預設",
  rollback_preset: "回退預設",
  manual_threshold_update: "手動調整閾值",
};

export default function AmenityIotScreen() {
  const colors = useColors();
  const router = useRouter();
  const HARDWARE_POLLING_MS = 5000;
  const FALLBACK_SPIKE_WINDOW = 8;
  const FALLBACK_SPIKE_MIN_COUNT = 3;
  const FALLBACK_SPIKE_MIN_RATE = 0.5;
  const ALERT_SNOOZE_MS = 10 * 60 * 1000;
  const ALERT_STATE_KEY = "admin.hardware.alertState.amenityIot";
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
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    status: "on" | "off";
    amenityId: number;
    deviceType: BulkDeviceType;
    riskLevel: RiskLevel;
    requiredPermissionTier: PermissionTier;
    requiresPin: boolean;
    reasonText: string;
  } | null>(null);

  const { data: devices = [], isLoading, refetch } = trpc.admin.amenityDevices.useQuery({});
  const { data: amenities = [] } = trpc.amenities.list.useQuery();
  const { data: gatewayHealth, isLoading: isGatewayHealthLoading, refetch: refetchGatewayHealth } = trpc.admin.hardwareGatewayHealth.useQuery(undefined, { refetchInterval: HARDWARE_POLLING_MS });
  const { data: dispatchHistory = [], isLoading: isDispatchLoading, refetch: refetchDispatchHistory } = trpc.admin.hardwareDispatchHistory.useQuery({ limit: FALLBACK_SPIKE_WINDOW }, { refetchInterval: HARDWARE_POLLING_MS });
  const {
    data: bulkAuditData,
    isLoading: isBulkAuditLoading,
    refetch: refetchBulkAuditLogs,
  } = trpc.admin.bulkControlAuditLogs.useQuery({
    limit: 12,
    amenityId: selectedAmenityId === "all" ? undefined : selectedAmenityId,
  });
  const {
    data: retentionData,
    isLoading: isRetentionLoading,
    refetch: refetchRetentionPolicy,
  } = trpc.admin.auditRetentionPolicy.useQuery();
  const {
    data: schedulerStatus,
    isLoading: isSchedulerStatusLoading,
    refetch: refetchSchedulerStatus,
  } = trpc.admin.auditCleanupSchedulerStatus.useQuery();
  const {
    data: cleanupPolicyStatus,
    refetch: refetchCleanupPolicyStatus,
  } = trpc.admin.auditCleanupPolicyStatus.useQuery();
  const {
    data: cleanupRunReports = [],
    isLoading: isCleanupRunReportsLoading,
    refetch: refetchCleanupRunReports,
  } = trpc.admin.auditCleanupRunReports.useQuery({ limit: 10 });
  const {
    data: cleanupRunSummary,
    refetch: refetchCleanupRunSummary,
  } = trpc.admin.auditCleanupRunSummary.useQuery({ windowHours: 24 });
  const {
    data: cleanupAlertStatus,
    refetch: refetchCleanupAlertStatus,
  } = trpc.admin.auditCleanupAlertStatus.useQuery({ windowHours: 24 });
  const { data: cleanupAlertPresets = [] } = trpc.admin.auditCleanupAlertPresets.useQuery();
  const {
    data: cleanupPresetHistory = [],
    isLoading: isCleanupPresetHistoryLoading,
    refetch: refetchCleanupPresetHistory,
  } = trpc.admin.auditCleanupPresetHistory.useQuery({ limit: 8 });
  const updateDeviceMutation = trpc.admin.controlDevice.useMutation();
  const bulkControlMutation = trpc.admin.bulkControlDevices.useMutation();
  const runAuditCleanupNowMutation = trpc.admin.runAuditCleanupNow.useMutation();
  const setAuditCleanupSchedulerMutation = trpc.admin.setAuditCleanupScheduler.useMutation();
  const applyCleanupAlertPresetMutation = trpc.admin.applyAuditCleanupAlertPreset.useMutation();
  const setCleanupPolicyLockModeMutation = trpc.admin.setAuditCleanupPolicyLockMode.useMutation();
  const importCleanupPolicyMutation = trpc.admin.importAuditCleanupPolicy.useMutation();
  const rollbackCleanupPresetMutation = trpc.admin.rollbackAuditCleanupAlertPreset.useMutation();
  const trpcUtils = trpc.useUtils();
  const amenityNameMap = useMemo(
    () => new Map(amenities.map((amenity) => [amenity.id, amenity.name])),
    [amenities],
  );
  const amenityOptions = useMemo(
    () => [{ id: "all" as const, name: "All Areas" }, ...amenities],
    [amenities],
  );
  const availableDeviceTypes = useMemo(
    () =>
      DEVICE_TYPE_OPTIONS.filter(
        (type) => type === "all" || devices.some((device) => device.type === type),
      ),
    [devices],
  );
  const selectedAmenityLabel: string = String(
    selectedAmenityId === "all" ? "All Areas" : amenityNameMap.get(selectedAmenityId) || `Amenity #${selectedAmenityId}`,
  );
  const selectedTargetDevices = useMemo(
    () =>
      devices.filter((device) => {
        const amenityMatched = selectedAmenityId === "all" || device.amenityId === selectedAmenityId;
        const typeMatched = selectedDeviceType === "all" || device.type === selectedDeviceType;
        return amenityMatched && typeMatched;
      }),
    [devices, selectedAmenityId, selectedDeviceType],
  );
  const recentFallbackCount = useMemo(
    () => dispatchHistory.filter((entry) => entry.result.fallbackUsed).length,
    [dispatchHistory],
  );
  const recentFallbackRate = dispatchHistory.length > 0 ? recentFallbackCount / dispatchHistory.length : 0;
  const isFallbackSpike = recentFallbackCount >= FALLBACK_SPIKE_MIN_COUNT && recentFallbackRate >= FALLBACK_SPIKE_MIN_RATE;
  const spikeSignature = useMemo(
    () =>
      dispatchHistory
        .slice(0, FALLBACK_SPIKE_WINDOW)
        .map((entry) => `${entry.id}:${entry.result.fallbackUsed ? 1 : 0}`)
        .join("|"),
    [dispatchHistory, FALLBACK_SPIKE_WINDOW],
  );
  const isSnoozed = snoozedUntil > Date.now();
  const isAcknowledged = acknowledgedSignature !== "" && acknowledgedSignature === spikeSignature;
  const showFallbackAlert = isFallbackSpike && !isSnoozed && !isAcknowledged;
  const alertStatusLabel = showFallbackAlert ? "ACTIVE" : isSnoozed ? "SNOOZED" : isAcknowledged ? "ACK" : "NORMAL";
  const alertStatusColor = showFallbackAlert ? colors.error : isSnoozed ? colors.warning : isAcknowledged ? colors.success : colors.muted;
  const isBulkGuardInvalid = selectedAmenityId === "all" || selectedDeviceType === "all";
  const isBulkActionDisabled =
    bulkControlMutation.isPending || isBulkGuardInvalid || selectedTargetDevices.length === 0;
  const lastAlertUpdateText = dispatchHistory[0]?.timestamp
    ? `Updated ${new Date(dispatchHistory[0].timestamp).toLocaleTimeString()}`
    : "Updated --";
  const bulkAuditItems = bulkAuditData?.items ?? [];
  const bulkAuditStats = bulkAuditData?.stats;
  const effectiveRetentionDays = retentionData?.policy.retentionDays;
  const effectiveMaxRecords = retentionData?.policy.maxRecords;
  const cleanupAlertLevel = cleanupAlertStatus?.level ?? "normal";
  const cleanupAlertColor =
    cleanupAlertLevel === "critical"
      ? colors.error
      : cleanupAlertLevel === "warning"
        ? colors.warning
        : colors.success;
  const selectedCleanupPreset: CleanupAlertPreset | null = useMemo(() => {
    if (!schedulerStatus) return null;
    const matched = cleanupAlertPresets.find(
      (preset) =>
        preset.failureThreshold === schedulerStatus.failureThreshold &&
        preset.consecutiveFailureThreshold === schedulerStatus.consecutiveFailureThreshold,
    );
    return (matched?.preset as CleanupAlertPreset | undefined) ?? null;
  }, [cleanupAlertPresets, schedulerStatus]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ALERT_STATE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { snoozedUntil?: number; acknowledgedSignature?: string };
        setSnoozedUntil(parsed.snoozedUntil || 0);
        setAcknowledgedSignature(parsed.acknowledgedSignature || "");
      } catch {
        setSnoozedUntil(0);
        setAcknowledgedSignature("");
      }
    })();
  }, [ALERT_STATE_KEY]);

  useEffect(() => {
    if (!retentionData?.policy) return;
    if (retentionDaysInput === "") {
      setRetentionDaysInput(String(retentionData.policy.retentionDays));
    }
    if (maxRecordsInput === "") {
      setMaxRecordsInput(String(retentionData.policy.maxRecords));
    }
  }, [retentionData, retentionDaysInput, maxRecordsInput]);

  useEffect(() => {
    if (!schedulerStatus) return;
    if (schedulerIntervalInput === "") {
      setSchedulerIntervalInput(String(schedulerStatus.intervalMinutes));
    }
    if (failureThresholdInput === "") {
      setFailureThresholdInput(String(schedulerStatus.failureThreshold));
    }
    if (consecutiveFailureThresholdInput === "") {
      setConsecutiveFailureThresholdInput(
        String(schedulerStatus.consecutiveFailureThreshold),
      );
    }
  }, [
    schedulerStatus,
    schedulerIntervalInput,
    failureThresholdInput,
    consecutiveFailureThresholdInput,
  ]);

  useEffect(() => {
    if (!cleanupPolicyStatus) return;
    if (policyImportInput !== "") return;
    setPolicyImportInput(
      JSON.stringify(
        {
          enabled: cleanupPolicyStatus.enabled,
          intervalMinutes: cleanupPolicyStatus.intervalMinutes,
          failureThreshold: cleanupPolicyStatus.failureThreshold,
          consecutiveFailureThreshold: cleanupPolicyStatus.consecutiveFailureThreshold,
          lockMode: cleanupPolicyStatus.lockMode,
        },
        null,
        2,
      ),
    );
  }, [cleanupPolicyStatus, policyImportInput]);

  const persistAlertState = async (nextSnoozedUntil: number, nextAcknowledgedSignature: string) => {
    setSnoozedUntil(nextSnoozedUntil);
    setAcknowledgedSignature(nextAcknowledgedSignature);
    try {
      await AsyncStorage.setItem(
        ALERT_STATE_KEY,
        JSON.stringify({
          snoozedUntil: nextSnoozedUntil,
          acknowledgedSignature: nextAcknowledgedSignature,
        }),
      );
    } catch {
      return;
    }
  };

  const handleSnooze = async () => {
    await persistAlertState(Date.now() + ALERT_SNOOZE_MS, acknowledgedSignature);
  };

  const handleAcknowledge = async () => {
    await persistAlertState(snoozedUntil, spikeSignature);
  };

  const getMutationErrorInfo = (error: unknown): { message: string; code?: string } => {
    if (typeof error === "object" && error !== null) {
      const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined;
      const maybeData = "data" in error ? (error as { data?: unknown }).data : undefined;
      const maybeCode =
        typeof maybeData === "object" && maybeData !== null && "code" in maybeData
          ? (maybeData as { code?: unknown }).code
          : undefined;
      return {
        message: typeof maybeMessage === "string" ? maybeMessage : "操作失敗",
        code: typeof maybeCode === "string" ? maybeCode : undefined,
      };
    }
    return { message: "操作失敗" };
  };

  const handleToggle = async (deviceId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "on" || currentStatus === "active" ? "off" : "on";
    try {
      setBulkErrorText("");
      await updateDeviceMutation.mutateAsync({ deviceId, status: nextStatus });
      await Promise.all([refetch(), refetchGatewayHealth(), refetchDispatchHistory(), refetchBulkAuditLogs()]);
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Device control failed";
      setBulkErrorText(message);
    }
  };

  const executeBulkControl = async (
    status: "on" | "off",
    amenityId: number,
    deviceType: BulkDeviceType,
    verificationPin?: string,
  ) => {
    try {
      setBulkErrorText("");
      setPinErrorText("");
      const result = await bulkControlMutation.mutateAsync({
        status,
        amenityId,
        deviceType,
        verificationPin,
      });
      const targetLabel = `${selectedAmenityLabel.toUpperCase()} + ${DEVICE_TYPE_LABELS[deviceType].toUpperCase()}`;
      setBulkResultText(
        `Applied ${status.toUpperCase()} to ${targetLabel} • ${result.affected} devices • ${RISK_LEVEL_LABELS[result.risk.riskLevel]} • sent ${result.dispatchedCount} • fallback ${result.fallbackCount}`,
      );
      setPinValue("");
      setPendingBulkAction(null);
      setIsPinPanelVisible(false);
      await Promise.all([refetch(), refetchGatewayHealth(), refetchDispatchHistory(), refetchBulkAuditLogs()]);
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      if (errorInfo.message === "PIN_REQUIRED") {
        setIsPinPanelVisible(true);
        setPinErrorText("此操作為高風險，請輸入管理 PIN。");
        return;
      }
      if (errorInfo.message === "INVALID_PIN") {
        setIsPinPanelVisible(true);
        setPinErrorText("PIN 錯誤，請重新輸入。");
        return;
      }
      if (errorInfo.message === "INSUFFICIENT_BATCH_PERMISSION" || errorInfo.code === "FORBIDDEN") {
        setBulkErrorText("目前帳號權限不足，無法執行此批次控制。");
        return;
      }
      setBulkErrorText(errorInfo.message || "Bulk control failed");
    }
  };

  const handleBulkControl = async (status: "on" | "off") => {
    setBulkResultText("");
    if (selectedAmenityId === "all" || selectedDeviceType === "all") {
      setBulkErrorText("為確保安全，批次控制前請同時選擇區域與設備類型。");
      return;
    }
    const amenityId = selectedAmenityId;
    const deviceType = selectedDeviceType;
    if (selectedTargetDevices.length === 0) {
      setBulkErrorText("目前條件找不到可控制設備，請調整區域或類型。");
      return;
    }
    setBulkErrorText("");
    try {
      const riskPreview = await trpcUtils.admin.bulkControlRiskPreview.fetch({
        amenityId,
        deviceType,
        status,
      });
      const reasonText = riskPreview.reasons.length > 0 ? riskPreview.reasons.join("、") : "一般操作";
      Alert.alert(
        "確認批次控制",
        `將在 ${selectedAmenityLabel} 的 ${DEVICE_TYPE_LABELS[deviceType]} 類型設備執行 ${status.toUpperCase()}（共 ${selectedTargetDevices.length} 台）。\n風險等級：${RISK_LEVEL_LABELS[riskPreview.riskLevel]}（${riskPreview.requiredPermissionTier}）`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "確認執行",
            style: "destructive",
            onPress: async () => {
              if (riskPreview.requiresPin) {
                setPendingBulkAction({
                  status,
                  amenityId,
                  deviceType,
                  riskLevel: riskPreview.riskLevel,
                  requiredPermissionTier: riskPreview.requiredPermissionTier,
                  requiresPin: riskPreview.requiresPin,
                  reasonText,
                });
                setPinValue("");
                setPinErrorText("");
                setIsPinPanelVisible(true);
                return;
              }
              await executeBulkControl(status, amenityId, deviceType);
            },
          },
        ],
      );
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setBulkErrorText(errorInfo.message || "無法取得風險評估，請稍後重試。");
    }
  };

  const handlePinConfirm = async () => {
    if (!pendingBulkAction) return;
    if (!pinValue.trim()) {
      setPinErrorText("請輸入 PIN。");
      return;
    }
    await executeBulkControl(
      pendingBulkAction.status,
      pendingBulkAction.amenityId,
      pendingBulkAction.deviceType,
      pinValue,
    );
  };

  const handlePinCancel = () => {
    setPinValue("");
    setPinErrorText("");
    setPendingBulkAction(null);
    setIsPinPanelVisible(false);
  };

  const handleManualCleanup = async () => {
    setCleanupErrorText("");
    setCleanupResultText("");
    const parsedDays = Number.parseInt(retentionDaysInput, 10);
    const parsedMaxRecords = Number.parseInt(maxRecordsInput, 10);
    const hasDays = Number.isFinite(parsedDays) && parsedDays > 0;
    const hasMaxRecords = Number.isFinite(parsedMaxRecords) && parsedMaxRecords > 0;
    if (!hasDays || !hasMaxRecords) {
      setCleanupErrorText("請輸入有效的保留天數與最大筆數（皆需大於 0）。");
      return;
    }
    try {
      const result = await runAuditCleanupNowMutation.mutateAsync({
        retentionDays: parsedDays,
        maxRecords: parsedMaxRecords,
      });
      setCleanupResultText(
        `清理完成：刪除 ${result.totalDeleted} 筆（天數 ${result.deletedByDays}、筆數 ${result.deletedByCount}），剩餘 ${result.afterCount} 筆。`,
      );
      await Promise.all([
        refetchBulkAuditLogs(),
        refetchRetentionPolicy(),
        refetchSchedulerStatus(),
        refetchCleanupPolicyStatus(),
        refetchCleanupRunReports(),
        refetchCleanupRunSummary(),
        refetchCleanupAlertStatus(),
      ]);
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "清理失敗，請稍後再試。");
    }
  };

  const handleToggleSchedulerEnabled = async () => {
    if (!schedulerStatus) return;
    try {
      setCleanupErrorText("");
      await setAuditCleanupSchedulerMutation.mutateAsync({
        enabled: !schedulerStatus.enabled,
      });
      await refetchSchedulerStatus();
      await refetchCleanupAlertStatus();
      await refetchCleanupPolicyStatus();
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "更新排程狀態失敗。");
    }
  };

  const handleApplySchedulerInterval = async () => {
    const parsedInterval = Number.parseInt(schedulerIntervalInput, 10);
    if (!Number.isFinite(parsedInterval) || parsedInterval <= 0) {
      setCleanupErrorText("請輸入有效的排程間隔（分鐘，需大於 0）。");
      return;
    }
    try {
      setCleanupErrorText("");
      await setAuditCleanupSchedulerMutation.mutateAsync({
        intervalMinutes: parsedInterval,
      });
      await refetchSchedulerStatus();
      await refetchCleanupAlertStatus();
      await refetchCleanupPolicyStatus();
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "更新排程間隔失敗。");
    }
  };

  const handleApplyAlertThresholds = async () => {
    const parsedFailureThreshold = Number.parseInt(failureThresholdInput, 10);
    const parsedConsecutiveFailureThreshold = Number.parseInt(
      consecutiveFailureThresholdInput,
      10,
    );
    if (
      !Number.isFinite(parsedFailureThreshold) ||
      parsedFailureThreshold <= 0 ||
      !Number.isFinite(parsedConsecutiveFailureThreshold) ||
      parsedConsecutiveFailureThreshold <= 0
    ) {
      setCleanupErrorText("請輸入有效的警報閾值（皆需大於 0）。");
      return;
    }
    try {
      setCleanupErrorText("");
      await setAuditCleanupSchedulerMutation.mutateAsync({
        failureThreshold: parsedFailureThreshold,
        consecutiveFailureThreshold: parsedConsecutiveFailureThreshold,
      });
      await Promise.all([refetchSchedulerStatus(), refetchCleanupAlertStatus()]);
      await refetchCleanupPolicyStatus();
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "更新警報閾值失敗。");
    }
  };

  const handleApplyCleanupPreset = async (preset: CleanupAlertPreset) => {
    try {
      setCleanupErrorText("");
      await applyCleanupAlertPresetMutation.mutateAsync({ preset });
      await Promise.all([refetchSchedulerStatus(), refetchCleanupAlertStatus()]);
      await refetchCleanupPolicyStatus();
      await refetchCleanupPresetHistory();
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "套用警報預設失敗。");
    }
  };

  const handleRollbackCleanupPreset = async () => {
    try {
      setCleanupErrorText("");
      const result = await rollbackCleanupPresetMutation.mutateAsync();
      if (!result.rolledBack) {
        setCleanupErrorText("目前沒有可回退的預設。");
      }
      await Promise.all([
        refetchSchedulerStatus(),
        refetchCleanupPolicyStatus(),
        refetchCleanupAlertStatus(),
        refetchCleanupPresetHistory(),
      ]);
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "回退預設失敗。");
    }
  };

  const handleTogglePolicyLockMode = async () => {
    if (!cleanupPolicyStatus) return;
    try {
      setCleanupErrorText("");
      await setCleanupPolicyLockModeMutation.mutateAsync({
        lockMode: !cleanupPolicyStatus.lockMode,
      });
      await Promise.all([refetchCleanupPolicyStatus(), refetchSchedulerStatus()]);
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "更新政策鎖定失敗。");
    }
  };

  const handleImportCleanupPolicy = async () => {
    try {
      const parsed = JSON.parse(policyImportInput);
      await importCleanupPolicyMutation.mutateAsync(parsed);
      await Promise.all([
        refetchCleanupPolicyStatus(),
        refetchSchedulerStatus(),
        refetchCleanupAlertStatus(),
      ]);
      setCleanupErrorText("");
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "匯入政策設定失敗 (格式錯誤或簽名無效)。");
    }
  };

  const handleExportCleanupPolicy = async () => {
    try {
      setCleanupErrorText("");
      const policy = await trpcUtils.admin.exportAuditCleanupPolicy.fetch();
      setPolicyImportInput(JSON.stringify(policy, null, 2));
    } catch (error) {
      const errorInfo = getMutationErrorInfo(error);
      setCleanupErrorText(errorInfo.message || "匯出政策失敗。");
    }
  };

  return (
    <ScreenContainer edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Amenity IoT Control</Text>
        <View style={styles.headerStatusWrap}>
          <View style={[styles.headerStatusBadge, { backgroundColor: alertStatusColor + "20" }]}>
            <Text style={[styles.headerStatusText, { color: alertStatusColor }]}>{alertStatusLabel}</Text>
          </View>
          <Text style={[styles.headerStatusMeta, { color: colors.muted }]}>{lastAlertUpdateText}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.muted, marginBottom: 0 }]}>HARDWARE GATEWAY</Text>
          {showFallbackAlert && (
            <View style={styles.warningTag}>
              <Text style={styles.warningTagText}>FALLBACK SPIKE</Text>
            </View>
          )}
        </View>
        {isGatewayHealthLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : (
          <View style={[styles.healthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.healthRow}>
              <Text style={[styles.healthLabel, { color: colors.foreground }]}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: gatewayHealth?.status === "healthy" ? colors.success + "20" : colors.warning + "20" }]}>
                <Text style={[styles.statusText, { color: gatewayHealth?.status === "healthy" ? colors.success : colors.warning }]}>
                  {(gatewayHealth?.status || "unknown").toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.healthRow}>
              <Text style={[styles.healthLabel, { color: colors.foreground }]}>Adapter</Text>
              <Text style={[styles.healthValue, { color: colors.muted }]}>{gatewayHealth?.config?.adapterResolved || "none"}</Text>
            </View>
            <View style={styles.healthStatsRow}>
              <View style={styles.healthStatItem}>
                <Text style={[styles.healthStatValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.totalDispatches || 0}</Text>
                <Text style={[styles.healthStatLabel, { color: colors.muted }]}>Dispatches</Text>
              </View>
              <View style={styles.healthStatItem}>
                <Text style={[styles.healthStatValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.dispatchedCommands || 0}</Text>
                <Text style={[styles.healthStatLabel, { color: colors.muted }]}>Sent</Text>
              </View>
              <View style={styles.healthStatItem}>
                <Text style={[styles.healthStatValue, { color: colors.foreground }]}>{gatewayHealth?.counters?.fallbackDispatches || 0}</Text>
                <Text style={[styles.healthStatLabel, { color: colors.muted }]}>Fallbacks</Text>
              </View>
            </View>
            {showFallbackAlert && (
              <View style={styles.alertControls}>
                <TouchableOpacity style={[styles.alertButton, { borderColor: colors.border }]} onPress={handleAcknowledge}>
                  <Text style={[styles.alertButtonText, { color: colors.foreground }]}>Acknowledge</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.alertButton, { borderColor: colors.border }]} onPress={handleSnooze}>
                  <Text style={[styles.alertButtonText, { color: colors.foreground }]}>Snooze 10m</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.muted }]}>PUBLIC INFRASTRUCTURE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorChipRow}
        >
          {amenityOptions.map((amenity) => {
            const isSelected = selectedAmenityId === amenity.id;
            return (
              <TouchableOpacity
                key={amenity.id}
                style={[
                  styles.selectorChip,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary + "20" : colors.surface,
                  },
                ]}
                onPress={() => setSelectedAmenityId(amenity.id)}
              >
                <Text style={[styles.selectorChipText, { color: isSelected ? colors.primary : colors.muted }]}>
                  {amenity.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorChipRow}
        >
          {availableDeviceTypes.map((type) => {
            const isSelected = selectedDeviceType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.selectorChip,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary + "20" : colors.surface,
                  },
                ]}
                onPress={() => setSelectedDeviceType(type)}
              >
                <Text style={[styles.selectorChipText, { color: isSelected ? colors.primary : colors.muted }]}>
                  {DEVICE_TYPE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={[styles.bulkFilterHint, { color: colors.muted }]}>
          Target: {selectedAmenityLabel} + {DEVICE_TYPE_LABELS[selectedDeviceType]} • {selectedTargetDevices.length} devices
        </Text>
        <Text style={[styles.bulkFilterHint, { color: colors.muted }]}>
          Safety rule: 必須同時選擇區域與類型，才可執行批次控制。
        </Text>
        <View style={styles.bulkActionRow}>
          <TouchableOpacity
            style={[
              styles.bulkButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: isBulkActionDisabled ? 0.5 : 1,
              },
            ]}
            disabled={isBulkActionDisabled}
            onPress={() => handleBulkControl("on")}
          >
            <IconSymbol name="Power" size={16} color={colors.success} />
            <Text style={[styles.bulkButtonText, { color: colors.foreground }]}>All ON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.bulkButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: isBulkActionDisabled ? 0.5 : 1,
              },
            ]}
            disabled={isBulkActionDisabled}
            onPress={() => handleBulkControl("off")}
          >
            <IconSymbol name="PowerOff" size={16} color={colors.error} />
            <Text style={[styles.bulkButtonText, { color: colors.foreground }]}>All OFF</Text>
          </TouchableOpacity>
        </View>
        {bulkErrorText ? (
          <Text style={[styles.bulkErrorText, { color: colors.error }]}>{bulkErrorText}</Text>
        ) : null}
        {bulkResultText ? (
          <Text style={[styles.bulkResultText, { color: colors.muted }]}>{bulkResultText}</Text>
        ) : null}
        {isPinPanelVisible && pendingBulkAction ? (
          <View style={[styles.pinPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pinPanelTitle, { color: colors.foreground }]}>高風險操作二次驗證</Text>
            <Text style={[styles.pinPanelMeta, { color: colors.muted }]}>
              風險：{RISK_LEVEL_LABELS[pendingBulkAction.riskLevel]}（{pendingBulkAction.requiredPermissionTier}）
            </Text>
            <Text style={[styles.pinPanelMeta, { color: colors.muted }]}>
              原因：{pendingBulkAction.reasonText}
            </Text>
            <TextInput
              value={pinValue}
              onChangeText={(value) => {
                setPinValue(value);
                if (pinErrorText) setPinErrorText("");
              }}
              placeholder="輸入管理 PIN"
              placeholderTextColor={colors.muted}
              secureTextEntry
              keyboardType="number-pad"
              style={[styles.pinInput, { borderColor: colors.border, color: colors.foreground }]}
            />
            {pinErrorText ? (
              <Text style={[styles.pinErrorText, { color: colors.error }]}>{pinErrorText}</Text>
            ) : null}
            <View style={styles.pinActionRow}>
              <TouchableOpacity
                style={[styles.pinActionButton, { borderColor: colors.border }]}
                onPress={handlePinCancel}
                disabled={bulkControlMutation.isPending}
              >
                <Text style={[styles.pinActionButtonText, { color: colors.muted }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pinActionButton,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + "20",
                    opacity: bulkControlMutation.isPending ? 0.5 : 1,
                  },
                ]}
                onPress={handlePinConfirm}
                disabled={bulkControlMutation.isPending}
              >
                <Text style={[styles.pinActionButtonText, { color: colors.primary }]}>
                  {bulkControlMutation.isPending ? "驗證中..." : "驗證並執行"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          devices.map((device) => (
            <View key={device.id} style={[styles.deviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: (device.status === "on" || device.status === "active") ? colors.primary + "20" : "#333" }]}>
                <IconSymbol name={device.type === "power" ? "bolt.fill" : "lightbulb.fill"} size={20} color={(device.status === "on" || device.status === "active") ? colors.primary : colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.deviceName, { color: colors.foreground }]}>{device.name}</Text>
                <Text style={[styles.deviceStatus, { color: (device.status === "on" || device.status === "active") ? colors.primary : colors.muted }]}>{device.status.toUpperCase()}</Text>
              </View>
              <Switch
                value={device.status === "on" || device.status === "active"}
                onValueChange={() => handleToggle(device.id, device.status)}
                trackColor={{ false: "#333", true: colors.primary }}
              />
            </View>
          ))
        )}

        <View style={[styles.sectionTitleRow, { marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted, marginBottom: 0 }]}>RECENT DISPATCH HISTORY</Text>
          {showFallbackAlert && (
            <View style={styles.warningTag}>
              <Text style={styles.warningTagText}>FALLBACK SPIKE</Text>
            </View>
          )}
        </View>
        <View style={[styles.historyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {isDispatchLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : dispatchHistory.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>No dispatch activity yet</Text>
          ) : (
            dispatchHistory.map((entry) => (
              <View key={entry.id} style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                <View style={[styles.historyIcon, { backgroundColor: entry.result.commandDispatched ? colors.success + "20" : colors.warning + "20" }]}>
                  <IconSymbol
                    name={entry.result.commandDispatched ? "checkmark.circle.fill" : "arrow.triangle.2.circlepath"}
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

        <View style={[styles.sectionTitleRow, { marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.muted, marginBottom: 0 }]}>BATCH CONTROL AUDIT</Text>
          {bulkAuditStats ? (
            <Text style={[styles.auditSummaryText, { color: colors.muted }]}>
              24h {bulkAuditStats.last24hCount} • 成功 {bulkAuditStats.successCount} • 拒絕 {bulkAuditStats.rejectedCount}
            </Text>
          ) : null}
        </View>
        <View style={[styles.retentionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.retentionTitle, { color: colors.foreground }]}>審計資料保留策略</Text>
          {isRetentionLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              {cleanupAlertStatus && cleanupAlertStatus.level !== "normal" ? (
                <View style={[styles.cleanupAlertBox, { borderColor: cleanupAlertColor, backgroundColor: cleanupAlertColor + "15" }]}>
                  <Text style={[styles.cleanupAlertTitle, { color: cleanupAlertColor }]}>
                    {cleanupAlertStatus.level === "critical" ? "清理警報：CRITICAL" : "清理警報：WARNING"}
                  </Text>
                  <Text style={[styles.cleanupAlertMeta, { color: colors.foreground }]}>
                    {cleanupAlertStatus.message}
                  </Text>
                  <Text style={[styles.cleanupAlertMeta, { color: colors.muted }]}>
                    24h 失敗 {cleanupAlertStatus.failedRuns} 次，連續失敗 {cleanupAlertStatus.consecutiveFailures} 次
                  </Text>
                  <Text style={[styles.cleanupAlertMeta, { color: colors.muted }]}>
                    風險分數 {cleanupAlertStatus.riskScore}/100 • 建議預設 {CLEANUP_PRESET_LABELS[cleanupAlertStatus.recommendedPreset as CleanupAlertPreset]}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.schedulerBox, { borderColor: colors.border }]}>
                <View style={styles.schedulerRow}>
                  <Text style={[styles.schedulerLabel, { color: colors.foreground }]}>自動清理</Text>
                  {isSchedulerStatusLoading ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            schedulerStatus?.enabled
                              ? colors.success + "20"
                              : colors.warning + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: schedulerStatus?.enabled
                              ? colors.success
                              : colors.warning,
                          },
                        ]}
                      >
                        {schedulerStatus?.enabled ? "ENABLED" : "PAUSED"}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.schedulerMeta, { color: colors.muted }]}>
                  下一次：{schedulerStatus?.nextRunAt ? new Date(schedulerStatus.nextRunAt).toLocaleString() : "--"}
                </Text>
                <Text style={[styles.schedulerMeta, { color: colors.muted }]}>
                  上次執行：{schedulerStatus?.lastRunAt ? new Date(schedulerStatus.lastRunAt).toLocaleString() : "--"}
                </Text>
                <Text style={[styles.schedulerMeta, { color: colors.muted }]}>
                  警報閾值：24h 失敗 {schedulerStatus?.failureThreshold ?? "--"} 次 / 連續失敗 {schedulerStatus?.consecutiveFailureThreshold ?? "--"} 次
                </Text>
                <Text style={[styles.schedulerMeta, { color: colors.muted }]}>
                  政策鎖定：{cleanupPolicyStatus?.lockMode ? "ON" : "OFF"}
                </Text>
                {!!schedulerStatus?.lastResult && (
                  <Text style={[styles.schedulerMeta, { color: colors.muted }]}>
                    上次刪除：{schedulerStatus.lastResult.totalDeleted} 筆
                  </Text>
                )}
                {!!schedulerStatus?.lastError && (
                  <Text style={[styles.retentionErrorText, { color: colors.error }]}>
                    排程錯誤：{schedulerStatus.lastError}
                  </Text>
                )}
                <View style={styles.schedulerInputRow}>
                  <TextInput
                    value={schedulerIntervalInput}
                    onChangeText={setSchedulerIntervalInput}
                    keyboardType="number-pad"
                    placeholder="排程間隔(分鐘)"
                    placeholderTextColor={colors.muted}
                    style={[styles.retentionInput, { borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>
                <View style={styles.schedulerInputRow}>
                  <TextInput
                    value={failureThresholdInput}
                    onChangeText={setFailureThresholdInput}
                    keyboardType="number-pad"
                    placeholder="24h 失敗閾值"
                    placeholderTextColor={colors.muted}
                    style={[styles.retentionInput, { borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>
                <View style={styles.schedulerInputRow}>
                  <TextInput
                    value={consecutiveFailureThresholdInput}
                    onChangeText={setConsecutiveFailureThresholdInput}
                    keyboardType="number-pad"
                    placeholder="連續失敗閾值"
                    placeholderTextColor={colors.muted}
                    style={[styles.retentionInput, { borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectorChipRow}
                >
                  {(cleanupAlertPresets.length > 0
                    ? cleanupAlertPresets.map((item) => item.preset as CleanupAlertPreset)
                    : (Object.keys(CLEANUP_PRESET_LABELS) as CleanupAlertPreset[])
                  ).map((preset) => {
                    const isSelected = selectedCleanupPreset === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.selectorChip,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected ? colors.primary + "20" : colors.surface,
                            opacity: applyCleanupAlertPresetMutation.isPending ? 0.6 : 1,
                          },
                        ]}
                        disabled={applyCleanupAlertPresetMutation.isPending}
                        onPress={() => handleApplyCleanupPreset(preset)}
                      >
                        <Text style={[styles.selectorChipText, { color: isSelected ? colors.primary : colors.muted }]}>
                          {CLEANUP_PRESET_LABELS[preset]}
                        </Text>
                        <Text style={[styles.presetChipMeta, { color: isSelected ? colors.primary : colors.muted }]}>
                          {CLEANUP_PRESET_DESCRIPTIONS[preset]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.schedulerActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.retentionActionButton,
                      {
                        flex: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        opacity: setAuditCleanupSchedulerMutation.isPending ? 0.5 : 1,
                      },
                    ]}
                    disabled={setAuditCleanupSchedulerMutation.isPending}
                    onPress={handleToggleSchedulerEnabled}
                  >
                    <Text style={[styles.retentionActionText, { color: colors.foreground }]}>
                      {schedulerStatus?.enabled ? "暫停自動清理" : "啟用自動清理"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.retentionActionButton,
                      {
                        flex: 1,
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + "20",
                        opacity: setAuditCleanupSchedulerMutation.isPending ? 0.5 : 1,
                      },
                    ]}
                    disabled={setAuditCleanupSchedulerMutation.isPending}
                    onPress={handleApplySchedulerInterval}
                  >
                    <Text style={[styles.retentionActionText, { color: colors.primary }]}>
                      套用排程間隔
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[
                    styles.retentionActionButton,
                    {
                      borderColor: colors.warning,
                      backgroundColor: colors.warning + "20",
                      opacity: setAuditCleanupSchedulerMutation.isPending ? 0.5 : 1,
                    },
                  ]}
                  disabled={setAuditCleanupSchedulerMutation.isPending}
                  onPress={handleApplyAlertThresholds}
                >
                  <Text style={[styles.retentionActionText, { color: colors.warning }]}>
                    套用警報閾值
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.retentionActionButton,
                    {
                      borderColor: colors.error,
                      backgroundColor: colors.error + "20",
                      opacity: rollbackCleanupPresetMutation.isPending ? 0.5 : 1,
                    },
                  ]}
                  disabled={rollbackCleanupPresetMutation.isPending}
                  onPress={handleRollbackCleanupPreset}
                >
                  <Text style={[styles.retentionActionText, { color: colors.error }]}>
                    {rollbackCleanupPresetMutation.isPending ? "回退中..." : "回退上一個預設"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.retentionActionButton,
                    {
                      borderColor: colors.muted,
                      backgroundColor: colors.surface,
                      opacity: setCleanupPolicyLockModeMutation.isPending ? 0.5 : 1,
                    },
                  ]}
                  disabled={setCleanupPolicyLockModeMutation.isPending}
                  onPress={handleTogglePolicyLockMode}
                >
                  <Text style={[styles.retentionActionText, { color: colors.foreground }]}>
                    {cleanupPolicyStatus?.lockMode ? "解除政策鎖定" : "啟用政策鎖定"}
                  </Text>
                </TouchableOpacity>
                <View style={styles.schedulerInputRow}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Text style={[styles.schedulerLabel, { color: colors.foreground, marginBottom: 0 }]}>政策匯入 / 匯出</Text>
                    <TouchableOpacity
                      onPress={handleExportCleanupPolicy}
                      style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surface, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>匯出簽名政策</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={policyImportInput}
                    onChangeText={setPolicyImportInput}
                    multiline
                    numberOfLines={6}
                    placeholder="貼上政策 JSON (支援簽名信封)"
                    placeholderTextColor={colors.muted}
                    style={[styles.policyInput, { borderColor: colors.border, color: colors.foreground }]}
                  />
                  <TouchableOpacity
                    style={[
                      styles.retentionActionButton,
                      {
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + "20",
                        opacity: importCleanupPolicyMutation.isPending ? 0.5 : 1,
                      },
                    ]}
                    disabled={importCleanupPolicyMutation.isPending}
                    onPress={handleImportCleanupPolicy}
                  >
                    <Text style={[styles.retentionActionText, { color: colors.primary }]}>
                      {importCleanupPolicyMutation.isPending ? "匯入中..." : "套用政策 JSON"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.schedulerBox, { borderColor: colors.border }]}>
                  <Text style={[styles.schedulerLabel, { color: colors.foreground }]}>預設變更歷史</Text>
                  {isCleanupPresetHistoryLoading ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : cleanupPresetHistory.length === 0 ? (
                    <Text style={[styles.schedulerMeta, { color: colors.muted }]}>尚無預設變更記錄</Text>
                  ) : (
                    cleanupPresetHistory.map((item) => (
                      <View key={item.id} style={styles.presetHistoryItem}>
                        <Text style={[styles.schedulerMeta, { color: colors.foreground }]}>
                          {PRESET_HISTORY_ACTION_LABELS[item.action as PresetHistoryAction]} • {item.preset ? CLEANUP_PRESET_LABELS[item.preset as CleanupAlertPreset] : "Custom"}
                        </Text>
                        <Text style={[styles.schedulerMeta, { color: colors.muted }]}>
                          {new Date(item.timestamp).toLocaleString()} • {item.actorOpenId || "system"}
                        </Text>
                        <Text style={[styles.schedulerMeta, { color: colors.muted }]}>
                          {item.previousFailureThreshold}/{item.previousConsecutiveFailureThreshold} → {item.nextFailureThreshold}/{item.nextConsecutiveFailureThreshold}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
              <Text style={[styles.retentionMeta, { color: colors.muted }]}>
                目前策略：保留 {effectiveRetentionDays ?? "--"} 天，最多 {effectiveMaxRecords ?? "--"} 筆。
              </Text>
              <Text style={[styles.retentionMeta, { color: colors.muted }]}>
                預估可清理：{retentionData?.preview.totalDeleted ?? 0} 筆（天數 {retentionData?.preview.deletedByDays ?? 0}、筆數 {retentionData?.preview.deletedByCount ?? 0}）
              </Text>
              <View style={styles.retentionInputRow}>
                <TextInput
                  value={retentionDaysInput}
                  onChangeText={setRetentionDaysInput}
                  keyboardType="number-pad"
                  placeholder="保留天數"
                  placeholderTextColor={colors.muted}
                  style={[styles.retentionInput, { borderColor: colors.border, color: colors.foreground }]}
                />
                <TextInput
                  value={maxRecordsInput}
                  onChangeText={setMaxRecordsInput}
                  keyboardType="number-pad"
                  placeholder="最大筆數"
                  placeholderTextColor={colors.muted}
                  style={[styles.retentionInput, { borderColor: colors.border, color: colors.foreground }]}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.retentionActionButton,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + "20",
                    opacity: runAuditCleanupNowMutation.isPending ? 0.5 : 1,
                  },
                ]}
                disabled={runAuditCleanupNowMutation.isPending}
                onPress={handleManualCleanup}
              >
                <Text style={[styles.retentionActionText, { color: colors.primary }]}>
                  {runAuditCleanupNowMutation.isPending ? "清理中..." : "手動清理審計資料"}
                </Text>
              </TouchableOpacity>
              {cleanupErrorText ? (
                <Text style={[styles.retentionErrorText, { color: colors.error }]}>{cleanupErrorText}</Text>
              ) : null}
              {cleanupResultText ? (
                <Text style={[styles.retentionResultText, { color: colors.muted }]}>{cleanupResultText}</Text>
              ) : null}
            </>
          )}
        </View>
        <View style={[styles.retentionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.retentionTitle, { color: colors.foreground, marginBottom: 0 }]}>自動清理執行報告</Text>
            {cleanupRunSummary ? (
              <Text style={[styles.auditSummaryText, { color: colors.muted }]}>
                24h {cleanupRunSummary.totalRuns} 次 • 失敗 {cleanupRunSummary.failedRuns} • 刪除 {cleanupRunSummary.totalDeleted}
              </Text>
            ) : null}
          </View>
          {isCleanupRunReportsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : cleanupRunReports.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>尚無自動清理執行紀錄</Text>
          ) : (
            cleanupRunReports.map((report) => {
              const reportColor = report.success ? colors.success : colors.error;
              return (
                <View key={report.id} style={[styles.reportItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.auditRow}>
                    <Text style={[styles.auditTitle, { color: colors.foreground }]}>
                      {CLEANUP_SOURCE_LABELS[report.source as CleanupRunSource]} • {report.success ? "成功" : "失敗"}
                    </Text>
                    <Text style={[styles.auditResultTag, { color: reportColor }]}>
                      {report.success ? "OK" : "ERR"}
                    </Text>
                  </View>
                  <Text style={[styles.auditMeta, { color: colors.muted }]}>
                    {new Date(report.timestamp).toLocaleString()} • {report.durationMs}ms
                  </Text>
                  <Text style={[styles.auditMeta, { color: colors.muted }]}>
                    刪除 {report.result?.totalDeleted ?? 0} 筆（天數 {report.result?.deletedByDays ?? 0}、筆數 {report.result?.deletedByCount ?? 0}）
                  </Text>
                  {report.errorMessage ? (
                    <Text style={[styles.auditErrorText, { color: colors.error }]}>{report.errorMessage}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
        <View style={[styles.auditBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {isBulkAuditLoading ? (
            <ActivityIndicator color={colors.primary} />
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
                <View key={entry.id} style={[styles.auditItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.auditRow}>
                    <Text style={[styles.auditTitle, { color: colors.foreground }]}>
                      {amenityLabel} • {DEVICE_TYPE_LABELS[entry.deviceType as BulkDeviceType]} • {entry.status.toUpperCase()}
                    </Text>
                    <Text style={[styles.auditResultTag, { color: resultColor }]}>
                      {AUDIT_RESULT_LABELS[entry.result as AuditResult]}
                    </Text>
                  </View>
                  <Text style={[styles.auditMeta, { color: colors.muted }]}>
                    {new Date(entry.timestamp).toLocaleString()} • 目標 {entry.targetDeviceCount} 台 • PIN {PIN_VERIFICATION_LABELS[entry.pinVerification as PinVerificationState]}
                  </Text>
                  <Text style={[styles.auditMeta, { color: colors.muted }]}>
                    風險：<Text style={{ color: riskColor }}>{RISK_LEVEL_LABELS[entry.riskLevel as RiskLevel]}</Text>（{entry.requiredPermissionTier}） • 發送 {entry.dispatchedCount} • fallback {entry.fallbackCount}
                  </Text>
                  {entry.errorMessage ? (
                    <Text style={[styles.auditErrorText, { color: colors.error }]}>
                      {entry.errorCode ? `${entry.errorCode}: ` : ""}{entry.errorMessage}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "800" },
  headerStatusWrap: { alignItems: "flex-end", gap: 2 },
  headerStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  headerStatusText: { fontSize: 10, fontWeight: "800" },
  headerStatusMeta: { fontSize: 9, fontWeight: "600" },
  content: { padding: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 16 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  healthCard: { borderRadius: 20, borderWidth: 1.5, padding: 16, marginBottom: 20, gap: 12 },
  healthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  healthLabel: { fontSize: 14, fontWeight: "700" },
  healthValue: { fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: "800" },
  healthStatsRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
  healthStatItem: { alignItems: "center", gap: 3 },
  healthStatValue: { fontSize: 16, fontWeight: "800" },
  healthStatLabel: { fontSize: 11, fontWeight: "600" },
  selectorChipRow: { flexDirection: "row", gap: 8, marginBottom: 10, paddingRight: 4 },
  selectorChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  selectorChipText: { fontSize: 12, fontWeight: "700" },
  presetChipMeta: { fontSize: 10, fontWeight: "600" },
  bulkFilterHint: { fontSize: 11, fontWeight: "600", marginBottom: 10 },
  bulkActionRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  bulkButton: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bulkButtonText: { fontSize: 13, fontWeight: "700" },
  bulkErrorText: { fontSize: 11, fontWeight: "700", marginBottom: 10 },
  bulkResultText: { fontSize: 11, fontWeight: "600", marginBottom: 10 },
  pinPanel: { borderWidth: 1.5, borderRadius: 14, padding: 12, marginBottom: 12, gap: 8 },
  pinPanelTitle: { fontSize: 13, fontWeight: "800" },
  pinPanelMeta: { fontSize: 11, fontWeight: "600" },
  pinInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: "700" },
  pinErrorText: { fontSize: 11, fontWeight: "700" },
  pinActionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  pinActionButton: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  pinActionButtonText: { fontSize: 12, fontWeight: "700" },
  deviceCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, borderWidth: 1.5, marginBottom: 12, gap: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  deviceName: { fontSize: 16, fontWeight: "700" },
  deviceStatus: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  historyBox: { borderRadius: 20, borderWidth: 1.5, paddingVertical: 4 },
  historyItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  historyIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  historyTitle: { fontSize: 13, fontWeight: "700" },
  historyMeta: { fontSize: 11, marginTop: 2 },
  historyTag: { fontSize: 10, fontWeight: "800" },
  retentionBox: { borderRadius: 16, borderWidth: 1.5, padding: 12, marginBottom: 12, gap: 8 },
  retentionTitle: { fontSize: 13, fontWeight: "800" },
  retentionMeta: { fontSize: 11, fontWeight: "600" },
  cleanupAlertBox: { borderWidth: 1.5, borderRadius: 12, padding: 10, gap: 4 },
  cleanupAlertTitle: { fontSize: 11, fontWeight: "900" },
  cleanupAlertMeta: { fontSize: 10, fontWeight: "600" },
  schedulerBox: { borderWidth: 1.5, borderRadius: 12, padding: 10, gap: 6 },
  schedulerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  schedulerLabel: { fontSize: 12, fontWeight: "800" },
  schedulerMeta: { fontSize: 10, fontWeight: "600" },
  presetHistoryItem: { gap: 2, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#00000022" },
  schedulerInputRow: { marginTop: 4 },
  schedulerActionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  policyInput: { borderWidth: 1.5, borderRadius: 10, minHeight: 96, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontWeight: "600", marginTop: 6 },
  retentionInputRow: { flexDirection: "row", gap: 8 },
  retentionInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  retentionActionButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  retentionActionText: { fontSize: 12, fontWeight: "700" },
  retentionErrorText: { fontSize: 11, fontWeight: "700" },
  retentionResultText: { fontSize: 11, fontWeight: "600" },
  auditSummaryText: { fontSize: 10, fontWeight: "600" },
  auditBox: { borderRadius: 20, borderWidth: 1.5, paddingVertical: 4, marginBottom: 12 },
  auditItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, gap: 4 },
  auditRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  auditTitle: { fontSize: 12, fontWeight: "700", flex: 1 },
  auditResultTag: { fontSize: 10, fontWeight: "800" },
  auditMeta: { fontSize: 10, fontWeight: "600" },
  auditErrorText: { fontSize: 10, fontWeight: "700" },
  reportItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, gap: 4 },
  emptyText: { textAlign: "center", paddingVertical: 16, fontSize: 12, fontWeight: "600" },
  warningTag: { backgroundColor: "#ED6C02", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  warningTagText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  alertControls: { flexDirection: "row", gap: 8, marginTop: 6 },
  alertButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  alertButtonText: { fontSize: 11, fontWeight: "700" },
});
