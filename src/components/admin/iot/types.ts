export const DEVICE_TYPE_OPTIONS = ["all", "light", "climate", "curtain", "security", "media", "power"] as const;
export type DeviceTypeOption = (typeof DEVICE_TYPE_OPTIONS)[number];
export type BulkDeviceType = Exclude<DeviceTypeOption, "all">;
export type AmenityFilterOption = number | "all";
export type RiskLevel = "low" | "medium" | "high";
export type PermissionTier = "L1" | "L2" | "L3";
export type AuditResult = "success" | "rejected" | "failed";
export type PinVerificationState = "not_required" | "passed" | "missing" | "failed";
export type CleanupRunSource = "scheduled" | "manual";
export type CleanupAlertPreset = "conservative" | "balanced" | "aggressive";
export type PresetHistoryAction = "apply_preset" | "rollback_preset" | "manual_threshold_update";

export const DEVICE_TYPE_LABELS: Record<DeviceTypeOption, string> = {
  all: "All Types",
  light: "Light",
  climate: "Climate",
  curtain: "Curtain",
  security: "Security",
  media: "Media",
  power: "Power",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "低風險",
  medium: "中風險",
  high: "高風險",
};

export const AUDIT_RESULT_LABELS: Record<AuditResult, string> = {
  success: "成功",
  rejected: "拒絕",
  failed: "失敗",
};

export const PIN_VERIFICATION_LABELS: Record<PinVerificationState, string> = {
  not_required: "免 PIN",
  passed: "驗證通過",
  missing: "未提供 PIN",
  failed: "PIN 驗證失敗",
};

export const CLEANUP_SOURCE_LABELS: Record<CleanupRunSource, string> = {
  scheduled: "排程",
  manual: "手動",
};

export const CLEANUP_PRESET_LABELS: Record<CleanupAlertPreset, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

export const CLEANUP_PRESET_DESCRIPTIONS: Record<CleanupAlertPreset, string> = {
  conservative: "Fast escalation for strict operations",
  balanced: "Balanced escalation and signal quality",
  aggressive: "Escalate only with stronger failure signals",
};

export const PRESET_HISTORY_ACTION_LABELS: Record<PresetHistoryAction, string> = {
  apply_preset: "套用預設",
  rollback_preset: "回退預設",
  manual_threshold_update: "手動調整閾值",
};

export type HardwareGatewayHealthInfo = {
  status: string;
  config?: {
    adapterResolved: string;
  };
  counters?: {
    totalDispatches: number;
    dispatchedCommands: number;
    fallbackDispatches: number;
  };
};

export type BulkAuditStats = {
  last24hCount: number;
  successCount: number;
  rejectedCount: number;
};

export type Amenity = {
  id: number;
  name: string;
};

export type Device = {
  id: number;
  name: string;
  type: string;
  status: string;
  amenityId: number;
};

export type BulkAuditItem = {
  id: string;
  amenityId: number;
  deviceType: string;
  status: string;
  result: string;
  timestamp: string | number | Date;
  targetDeviceCount: number;
  pinVerification: string;
  riskLevel: string;
  requiredPermissionTier: string;
  dispatchedCount: number;
  fallbackCount: number;
  errorMessage?: string;
  errorCode?: string;
};

export type PendingBulkAction = {
  status: "on" | "off";
  amenityId: number;
  deviceType: DeviceTypeOption;
  riskLevel: RiskLevel;
  requiredPermissionTier: string;
  reasonText: string;
} | null;

