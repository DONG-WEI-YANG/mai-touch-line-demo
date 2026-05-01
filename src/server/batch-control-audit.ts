import { createBatchControlAuditLog, queryBatchControlAuditLogs } from "./db";

export type BatchControlRiskLevel = "low" | "medium" | "high";
export type BatchControlPermissionTier = "L1" | "L2" | "L3";
export type BatchControlDeviceType =
  | "light"
  | "climate"
  | "curtain"
  | "security"
  | "media"
  | "power";

export type PinVerificationState =
  | "not_required"
  | "passed"
  | "missing"
  | "failed";

export type BatchControlAuditResult = "success" | "rejected" | "failed";

export interface BatchControlAuditEntry {
  id: string;
  timestamp: string;
  adminOpenId: string | null;
  amenityId: number;
  deviceType: BatchControlDeviceType;
  status: string;
  targetDeviceCount: number;
  riskLevel: BatchControlRiskLevel;
  riskReasons: string[];
  requiredPermissionTier: BatchControlPermissionTier;
  grantedPermissionTier: BatchControlPermissionTier;
  effectivePermissionTier: BatchControlPermissionTier;
  pinRequired: boolean;
  pinVerification: PinVerificationState;
  result: BatchControlAuditResult;
  dispatchedCount: number;
  fallbackCount: number;
  errorCode?: string;
  errorMessage?: string;
}

export type BatchControlAuditRecordInput = Omit<
  BatchControlAuditEntry,
  "id" | "timestamp"
>;

type BatchControlAuditQuery = {
  limit?: number;
  offset?: number;
  amenityId?: number;
  riskLevel?: BatchControlRiskLevel;
  result?: BatchControlAuditResult;
};

type BatchControlAuditStats = {
  total: number;
  successCount: number;
  rejectedCount: number;
  failedCount: number;
  highRiskCount: number;
  pinRequiredCount: number;
  pinFailedCount: number;
  last24hCount: number;
};

class BatchControlAuditLog {
  async record(input: BatchControlAuditRecordInput): Promise<BatchControlAuditEntry | null> {
    return createBatchControlAuditLog(input);
  }

  async query(filters: BatchControlAuditQuery): Promise<{
    total: number;
    items: BatchControlAuditEntry[];
    stats: BatchControlAuditStats;
  }> {
    return queryBatchControlAuditLogs(filters);
  }
}

const singleton = new BatchControlAuditLog();

export function getBatchControlAuditLog(): BatchControlAuditLog {
  return singleton;
}
