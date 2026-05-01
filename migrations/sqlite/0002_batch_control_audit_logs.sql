-- SQLite Migration: Batch Control Audit Logs
-- Date: 2026-03-15
-- Description: Persist bulk control audit records previously stored in memory

CREATE TABLE IF NOT EXISTS batch_control_audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  adminOpenId TEXT,
  amenityId INTEGER NOT NULL,
  deviceType TEXT NOT NULL CHECK(deviceType IN ('light', 'climate', 'curtain', 'security', 'media', 'power')),
  status TEXT NOT NULL,
  targetDeviceCount INTEGER NOT NULL,
  riskLevel TEXT NOT NULL CHECK(riskLevel IN ('low', 'medium', 'high')),
  riskReasons TEXT NOT NULL,
  requiredPermissionTier TEXT NOT NULL CHECK(requiredPermissionTier IN ('L1', 'L2', 'L3')),
  grantedPermissionTier TEXT NOT NULL CHECK(grantedPermissionTier IN ('L1', 'L2', 'L3')),
  effectivePermissionTier TEXT NOT NULL CHECK(effectivePermissionTier IN ('L1', 'L2', 'L3')),
  pinRequired INTEGER NOT NULL DEFAULT 0,
  pinVerification TEXT NOT NULL CHECK(pinVerification IN ('not_required', 'passed', 'missing', 'failed')),
  result TEXT NOT NULL CHECK(result IN ('success', 'rejected', 'failed')),
  dispatchedCount INTEGER NOT NULL DEFAULT 0,
  fallbackCount INTEGER NOT NULL DEFAULT 0,
  errorCode TEXT,
  errorMessage TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batch_control_audit_logs_createdAt
  ON batch_control_audit_logs(createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_batch_control_audit_logs_amenityId
  ON batch_control_audit_logs(amenityId);

CREATE INDEX IF NOT EXISTS idx_batch_control_audit_logs_riskLevel
  ON batch_control_audit_logs(riskLevel);

CREATE INDEX IF NOT EXISTS idx_batch_control_audit_logs_result
  ON batch_control_audit_logs(result);
