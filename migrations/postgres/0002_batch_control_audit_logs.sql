-- PostgreSQL Migration: Batch Control Audit Logs
-- Date: 2026-03-15
-- Description: Persist bulk control audit records previously stored in memory

CREATE TABLE IF NOT EXISTS batch_control_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp VARCHAR(40) NOT NULL,
  "adminOpenId" VARCHAR(64),
  "amenityId" INTEGER NOT NULL,
  "deviceType" VARCHAR(20) NOT NULL CHECK("deviceType" IN ('light', 'climate', 'curtain', 'security', 'media', 'power')),
  status VARCHAR(64) NOT NULL,
  "targetDeviceCount" INTEGER NOT NULL,
  "riskLevel" VARCHAR(10) NOT NULL CHECK("riskLevel" IN ('low', 'medium', 'high')),
  "riskReasons" TEXT NOT NULL,
  "requiredPermissionTier" VARCHAR(2) NOT NULL CHECK("requiredPermissionTier" IN ('L1', 'L2', 'L3')),
  "grantedPermissionTier" VARCHAR(2) NOT NULL CHECK("grantedPermissionTier" IN ('L1', 'L2', 'L3')),
  "effectivePermissionTier" VARCHAR(2) NOT NULL CHECK("effectivePermissionTier" IN ('L1', 'L2', 'L3')),
  "pinRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "pinVerification" VARCHAR(20) NOT NULL CHECK("pinVerification" IN ('not_required', 'passed', 'missing', 'failed')),
  result VARCHAR(20) NOT NULL CHECK(result IN ('success', 'rejected', 'failed')),
  "dispatchedCount" INTEGER NOT NULL DEFAULT 0,
  "fallbackCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(64),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batch_control_audit_logs_createdAt
  ON batch_control_audit_logs("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_batch_control_audit_logs_amenityId
  ON batch_control_audit_logs("amenityId");

CREATE INDEX IF NOT EXISTS idx_batch_control_audit_logs_riskLevel
  ON batch_control_audit_logs("riskLevel");

CREATE INDEX IF NOT EXISTS idx_batch_control_audit_logs_result
  ON batch_control_audit_logs(result);
