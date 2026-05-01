import { createHmac } from "crypto";
import { ENV } from "./_core/env";
import {
  cleanupBatchControlAuditLogs,
  getBatchControlAuditRetentionPolicy,
  type BatchControlAuditCleanupResult,
} from "./db";

type SchedulerConfigInput = {
  enabled?: boolean;
  intervalMinutes?: number;
  failureThreshold?: number;
  consecutiveFailureThreshold?: number;
};

type RunNowInput = {
  retentionDays?: number;
  maxRecords?: number;
};

export type AuditCleanupPolicyEnvelope = {
  config: AuditCleanupPolicyConfig;
  timestamp: number;
  signature: string;
};

export type AuditCleanupRunReport = {
  id: string;
  timestamp: string;
  source: "scheduled" | "manual";
  success: boolean;
  durationMs: number;
  result: BatchControlAuditCleanupResult | null;
  errorMessage: string | null;
};

export type AuditCleanupRunSummary = {
  windowHours: number;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  totalDeleted: number;
  avgDurationMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};

export type AuditCleanupAlertStatus = {
  windowHours: number;
  failureThreshold: number;
  consecutiveFailureThreshold: number;
  failedRuns: number;
  consecutiveFailures: number;
  riskScore: number;
  recommendedPreset: AuditCleanupAlertPreset;
  level: "normal" | "warning" | "critical";
  message: string;
};

export type AuditCleanupAlertPreset =
  | "conservative"
  | "balanced"
  | "aggressive";

export type AuditCleanupAlertPresetDefinition = {
  preset: AuditCleanupAlertPreset;
  label: string;
  description: string;
  failureThreshold: number;
  consecutiveFailureThreshold: number;
  sensitivityScore: number;
};

export type AuditCleanupPresetHistoryEntry = {
  id: string;
  timestamp: string;
  action: "apply_preset" | "rollback_preset" | "manual_threshold_update";
  actorOpenId: string | null;
  preset: AuditCleanupAlertPreset | null;
  previousFailureThreshold: number;
  previousConsecutiveFailureThreshold: number;
  nextFailureThreshold: number;
  nextConsecutiveFailureThreshold: number;
};

export type AuditCleanupSchedulerStatus = {
  enabled: boolean;
  intervalMinutes: number;
  failureThreshold: number;
  consecutiveFailureThreshold: number;
  currentPreset: AuditCleanupAlertPreset | null;
  lockMode: boolean;
  running: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  lastResult: BatchControlAuditCleanupResult | null;
};

export type AuditCleanupPolicyConfig = {
  enabled: boolean;
  intervalMinutes: number;
  failureThreshold: number;
  consecutiveFailureThreshold: number;
  lockMode: boolean;
};

const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_REPORT_LIMIT = 50;
const MAX_REPORT_LIMIT = 500;
const DEFAULT_ALERT_FAILURE_THRESHOLD = 3;
const DEFAULT_ALERT_CONSECUTIVE_FAILURE_THRESHOLD = 2;
const DEFAULT_PRESET_HISTORY_LIMIT = 100;
const ALERT_PRESETS: Record<AuditCleanupAlertPreset, AuditCleanupAlertPresetDefinition> = {
  conservative: {
    preset: "conservative",
    label: "Conservative",
    description: "Fast escalation, tighter failure guardrails",
    failureThreshold: 2,
    consecutiveFailureThreshold: 1,
    sensitivityScore: 90,
  },
  balanced: {
    preset: "balanced",
    label: "Balanced",
    description: "Default balance between noise and sensitivity",
    failureThreshold: 3,
    consecutiveFailureThreshold: 2,
    sensitivityScore: 70,
  },
  aggressive: {
    preset: "aggressive",
    label: "Aggressive",
    description: "Lower noise, alerts only on stronger failure signals",
    failureThreshold: 5,
    consecutiveFailureThreshold: 3,
    sensitivityScore: 45,
  },
};

function parseMaxReports(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(MAX_REPORT_LIMIT, parsed);
}

function parseEnabled(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  return fallback;
}

function parseIntervalMinutes(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseThreshold(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseLockMode(value: string | undefined, fallback: boolean): boolean {
  return parseEnabled(value, fallback);
}

function resolvePresetByThresholds(
  failureThreshold: number,
  consecutiveFailureThreshold: number,
): AuditCleanupAlertPreset | null {
  const matched = (Object.keys(ALERT_PRESETS) as AuditCleanupAlertPreset[]).find(
    (preset) =>
      ALERT_PRESETS[preset].failureThreshold === failureThreshold &&
      ALERT_PRESETS[preset].consecutiveFailureThreshold === consecutiveFailureThreshold,
  );
  return matched ?? null;
}

class AuditCleanupScheduler {
  private enabled = parseEnabled(process.env.BATCH_AUDIT_AUTO_CLEANUP_ENABLED, true);
  private intervalMinutes = parseIntervalMinutes(
    process.env.BATCH_AUDIT_AUTO_CLEANUP_INTERVAL_MINUTES,
    DEFAULT_INTERVAL_MINUTES,
  );
  private running = false;
  private nextRunAt: string | null = null;
  private lastRunAt: string | null = null;
  private lastError: string | null = null;
  private lastResult: BatchControlAuditCleanupResult | null = null;
  private timer: NodeJS.Timeout | null = null;
  private started = false;
  private reportMaxSize = parseMaxReports(process.env.BATCH_AUDIT_CLEANUP_REPORT_MAX, 200);
  private presetHistoryMaxSize = parseMaxReports(
    process.env.BATCH_AUDIT_PRESET_HISTORY_MAX,
    DEFAULT_PRESET_HISTORY_LIMIT,
  );
  private lockMode = parseLockMode(process.env.BATCH_AUDIT_POLICY_LOCK_MODE, false);
  private failureThreshold = parseThreshold(
    process.env.BATCH_AUDIT_ALERT_FAILURE_THRESHOLD,
    DEFAULT_ALERT_FAILURE_THRESHOLD,
  );
  private consecutiveFailureThreshold = parseThreshold(
    process.env.BATCH_AUDIT_ALERT_CONSECUTIVE_FAILURE_THRESHOLD,
    DEFAULT_ALERT_CONSECUTIVE_FAILURE_THRESHOLD,
  );
  private runReports: AuditCleanupRunReport[] = [];
  private presetHistory: AuditCleanupPresetHistoryEntry[] = [];

  start() {
    if (this.started) return;
    this.started = true;
    if (!this.enabled) return;
    this.scheduleNext();
  }

  configure(
    input: SchedulerConfigInput,
    actorOpenId: string | null = null,
  ): AuditCleanupSchedulerStatus {
    const previousFailureThreshold = this.failureThreshold;
    const previousConsecutiveFailureThreshold = this.consecutiveFailureThreshold;
    if (input.enabled !== undefined) {
      this.enabled = input.enabled;
    }
    if (input.intervalMinutes !== undefined) {
      this.intervalMinutes = Math.max(1, Math.trunc(input.intervalMinutes));
    }
    if (input.failureThreshold !== undefined) {
      this.failureThreshold = Math.max(1, Math.trunc(input.failureThreshold));
    }
    if (input.consecutiveFailureThreshold !== undefined) {
      this.consecutiveFailureThreshold = Math.max(
        1,
        Math.trunc(input.consecutiveFailureThreshold),
      );
    }
    if (
      previousFailureThreshold !== this.failureThreshold ||
      previousConsecutiveFailureThreshold !== this.consecutiveFailureThreshold
    ) {
      this.pushPresetHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        action: "manual_threshold_update",
        actorOpenId,
        preset: resolvePresetByThresholds(
          this.failureThreshold,
          this.consecutiveFailureThreshold,
        ),
        previousFailureThreshold,
        previousConsecutiveFailureThreshold,
        nextFailureThreshold: this.failureThreshold,
        nextConsecutiveFailureThreshold: this.consecutiveFailureThreshold,
      });
    }
    this.reschedule();
    return this.getStatus();
  }

  applyAlertPreset(
    preset: AuditCleanupAlertPreset,
    actorOpenId: string | null = null,
  ): AuditCleanupSchedulerStatus {
    const previousFailureThreshold = this.failureThreshold;
    const previousConsecutiveFailureThreshold = this.consecutiveFailureThreshold;
    const presetConfig = ALERT_PRESETS[preset];
    this.failureThreshold = presetConfig.failureThreshold;
    this.consecutiveFailureThreshold = presetConfig.consecutiveFailureThreshold;
    this.pushPresetHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      action: "apply_preset",
      actorOpenId,
      preset,
      previousFailureThreshold,
      previousConsecutiveFailureThreshold,
      nextFailureThreshold: this.failureThreshold,
      nextConsecutiveFailureThreshold: this.consecutiveFailureThreshold,
    });
    return this.getStatus();
  }

  getAlertPresets(): AuditCleanupAlertPresetDefinition[] {
    return (Object.keys(ALERT_PRESETS) as AuditCleanupAlertPreset[]).map(
      (preset) => ALERT_PRESETS[preset],
    );
  }

  getPresetHistory(limit: number = 20): AuditCleanupPresetHistoryEntry[] {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(MAX_REPORT_LIMIT, Math.trunc(limit)))
      : 20;
    return this.presetHistory.slice(0, normalizedLimit);
  }

  rollbackToPreviousPreset(
    actorOpenId: string | null = null,
  ): { status: AuditCleanupSchedulerStatus; rolledBack: boolean } {
    const currentPreset = resolvePresetByThresholds(
      this.failureThreshold,
      this.consecutiveFailureThreshold,
    );
    const targetEntry = this.presetHistory.find(
      (entry) => entry.preset !== null && entry.preset !== currentPreset,
    );
    if (!targetEntry || !targetEntry.preset) {
      return { status: this.getStatus(), rolledBack: false };
    }
    const previousFailureThreshold = this.failureThreshold;
    const previousConsecutiveFailureThreshold = this.consecutiveFailureThreshold;
    const presetConfig = ALERT_PRESETS[targetEntry.preset];
    this.failureThreshold = presetConfig.failureThreshold;
    this.consecutiveFailureThreshold = presetConfig.consecutiveFailureThreshold;
    this.pushPresetHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      action: "rollback_preset",
      actorOpenId,
      preset: targetEntry.preset,
      previousFailureThreshold,
      previousConsecutiveFailureThreshold,
      nextFailureThreshold: this.failureThreshold,
      nextConsecutiveFailureThreshold: this.consecutiveFailureThreshold,
    });
    return { status: this.getStatus(), rolledBack: true };
  }

  async runNow(input?: RunNowInput): Promise<BatchControlAuditCleanupResult> {
    return this.runCleanup({
      retentionDays: input?.retentionDays,
      maxRecords: input?.maxRecords,
      dryRun: false,
      source: "manual",
    });
  }

  getStatus(): AuditCleanupSchedulerStatus {
    return {
      enabled: this.enabled,
      intervalMinutes: this.intervalMinutes,
      failureThreshold: this.failureThreshold,
      consecutiveFailureThreshold: this.consecutiveFailureThreshold,
      currentPreset: resolvePresetByThresholds(
        this.failureThreshold,
        this.consecutiveFailureThreshold,
      ),
      lockMode: this.lockMode,
      running: this.running,
      nextRunAt: this.nextRunAt,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      lastResult: this.lastResult,
    };
  }

  getPolicyConfig(): AuditCleanupPolicyConfig {
    return {
      enabled: this.enabled,
      intervalMinutes: this.intervalMinutes,
      failureThreshold: this.failureThreshold,
      consecutiveFailureThreshold: this.consecutiveFailureThreshold,
      lockMode: this.lockMode,
    };
  }

  exportPolicyConfig(): AuditCleanupPolicyEnvelope {
    const config = this.getPolicyConfig();
    const timestamp = Date.now();
    const signature = this.signPolicyConfig(config, timestamp);
    return { config, timestamp, signature };
  }

  private signPolicyConfig(config: AuditCleanupPolicyConfig, timestamp: number): string {
    // Reconstruct object to ensure deterministic key order for signature
    const orderedConfig = {
      enabled: config.enabled,
      intervalMinutes: config.intervalMinutes,
      failureThreshold: config.failureThreshold,
      consecutiveFailureThreshold: config.consecutiveFailureThreshold,
      lockMode: config.lockMode,
    };
    const payload = JSON.stringify({ config: orderedConfig, timestamp });
    return createHmac("sha256", ENV.sessionSecret).update(payload).digest("hex");
  }

  setLockMode(lockMode: boolean): AuditCleanupSchedulerStatus {
    this.lockMode = lockMode;
    return this.getStatus();
  }

  importPolicyConfig(
    input: Partial<AuditCleanupPolicyConfig> | AuditCleanupPolicyEnvelope,
  ): AuditCleanupSchedulerStatus {
    let configToApply: Partial<AuditCleanupPolicyConfig>;

    if ("signature" in input && "timestamp" in input && "config" in input) {
      // Envelope mode
      const expectedSig = this.signPolicyConfig(input.config, input.timestamp);
      if (input.signature !== expectedSig) {
        throw new Error("Invalid policy signature");
      }
      configToApply = input.config;
    } else {
      // Legacy/Direct mode
      configToApply = input as Partial<AuditCleanupPolicyConfig>;
    }

    if (configToApply.enabled !== undefined) this.enabled = configToApply.enabled;
    if (configToApply.intervalMinutes !== undefined) {
      this.intervalMinutes = Math.max(1, Math.trunc(configToApply.intervalMinutes));
    }
    if (configToApply.failureThreshold !== undefined) {
      this.failureThreshold = Math.max(1, Math.trunc(configToApply.failureThreshold));
    }
    if (configToApply.consecutiveFailureThreshold !== undefined) {
      this.consecutiveFailureThreshold = Math.max(
        1,
        Math.trunc(configToApply.consecutiveFailureThreshold),
      );
    }
    if (configToApply.lockMode !== undefined) {
      this.lockMode = configToApply.lockMode;
    }
    this.reschedule();
    return this.getStatus();
  }

  getRunReports(limit?: number): AuditCleanupRunReport[] {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(MAX_REPORT_LIMIT, Math.trunc(limit ?? DEFAULT_REPORT_LIMIT)))
      : DEFAULT_REPORT_LIMIT;
    return this.runReports.slice(0, normalizedLimit);
  }

  getRunSummary(windowHours: number = 24): AuditCleanupRunSummary {
    const safeWindowHours = Number.isFinite(windowHours)
      ? Math.max(1, Math.min(24 * 30, Math.trunc(windowHours)))
      : 24;
    const cutoff = Date.now() - safeWindowHours * 60 * 60 * 1000;
    const windowReports = this.runReports.filter(
      (report) => new Date(report.timestamp).getTime() >= cutoff,
    );
    const successRuns = windowReports.filter((report) => report.success).length;
    const failedRuns = windowReports.length - successRuns;
    const totalDeleted = windowReports.reduce(
      (sum, report) => sum + (report.result?.totalDeleted ?? 0),
      0,
    );
    const avgDurationMs =
      windowReports.length === 0
        ? 0
        : Math.round(
            windowReports.reduce((sum, report) => sum + report.durationMs, 0) /
              windowReports.length,
          );
    const lastRunAt = this.runReports[0]?.timestamp ?? null;
    const lastSuccessAt =
      this.runReports.find((report) => report.success)?.timestamp ?? null;
    const lastFailureAt =
      this.runReports.find((report) => !report.success)?.timestamp ?? null;
    return {
      windowHours: safeWindowHours,
      totalRuns: windowReports.length,
      successRuns,
      failedRuns,
      totalDeleted,
      avgDurationMs,
      lastRunAt,
      lastSuccessAt,
      lastFailureAt,
    };
  }

  getAlertStatus(windowHours: number = 24): AuditCleanupAlertStatus {
    const summary = this.getRunSummary(windowHours);
    let consecutiveFailures = 0;
    for (const report of this.runReports) {
      if (!report.success) {
        consecutiveFailures += 1;
      } else {
        break;
      }
    }
    const isCritical =
      summary.failedRuns >= this.failureThreshold ||
      consecutiveFailures >= this.consecutiveFailureThreshold;
    const isWarning = !isCritical && summary.failedRuns > 0;
    const failureRatio =
      summary.totalRuns > 0 ? summary.failedRuns / summary.totalRuns : 0;
    const riskScore = Math.min(
      100,
      Math.round(
        failureRatio * 70 +
          Math.min(24, consecutiveFailures * 8) +
          (isCritical ? 18 : isWarning ? 8 : 0),
      ),
    );
    const level: AuditCleanupAlertStatus["level"] = isCritical
      ? "critical"
      : isWarning
        ? "warning"
        : "normal";
    const recommendedPreset: AuditCleanupAlertPreset =
      level === "critical"
        ? "conservative"
        : level === "warning"
          ? "balanced"
          : "aggressive";
    const message =
      level === "critical"
        ? `Cleanup failure threshold exceeded (${summary.failedRuns}/${this.failureThreshold})`
        : level === "warning"
          ? `Cleanup has ${summary.failedRuns} failed run(s) in ${summary.windowHours}h`
          : "Cleanup runs are healthy";
    return {
      windowHours: summary.windowHours,
      failureThreshold: this.failureThreshold,
      consecutiveFailureThreshold: this.consecutiveFailureThreshold,
      failedRuns: summary.failedRuns,
      consecutiveFailures,
      riskScore,
      recommendedPreset,
      level,
      message,
    };
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private reschedule() {
    this.clearTimer();
    this.nextRunAt = null;
    if (!this.started || !this.enabled) return;
    this.scheduleNext();
  }

  private scheduleNext() {
    this.clearTimer();
    const intervalMs = this.intervalMinutes * 60 * 1000;
    this.nextRunAt = new Date(Date.now() + intervalMs).toISOString();
    this.timer = setTimeout(async () => {
      await this.runCleanup({ source: "scheduled" });
      if (this.enabled) {
        this.scheduleNext();
      } else {
        this.nextRunAt = null;
      }
    }, intervalMs);
  }

  private async runCleanup(
    input?: RunNowInput & { dryRun?: boolean; source?: "scheduled" | "manual" },
  ): Promise<BatchControlAuditCleanupResult> {
    if (this.running) {
      const retentionPolicy = getBatchControlAuditRetentionPolicy();
      return {
        beforeCount: this.lastResult?.beforeCount ?? 0,
        afterCount: this.lastResult?.afterCount ?? 0,
        deletedByDays: 0,
        deletedByCount: 0,
        totalDeleted: 0,
        retentionDays: input?.retentionDays ?? retentionPolicy.retentionDays,
        maxRecords: input?.maxRecords ?? retentionPolicy.maxRecords,
        cutoffTimestamp: new Date().toISOString(),
        dryRun: false,
      };
    }
    this.running = true;
    this.lastError = null;
    const startedAt = Date.now();
    const source = input?.source ?? "manual";
    try {
      const result = await cleanupBatchControlAuditLogs({
        retentionDays: input?.retentionDays,
        maxRecords: input?.maxRecords,
        dryRun: input?.dryRun ?? false,
      });
      this.lastRunAt = new Date().toISOString();
      this.lastResult = result;
      this.pushReport({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        source,
        success: true,
        durationMs: Date.now() - startedAt,
        result,
        errorMessage: null,
      });
      return result;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Unknown cleanup scheduler error";
      this.pushReport({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        source,
        success: false,
        durationMs: Date.now() - startedAt,
        result: null,
        errorMessage: this.lastError,
      });
      throw error;
    } finally {
      this.running = false;
    }
  }

  private pushReport(report: AuditCleanupRunReport) {
    this.runReports.unshift(report);
    if (this.runReports.length > this.reportMaxSize) {
      this.runReports.length = this.reportMaxSize;
    }
  }

  private pushPresetHistory(entry: AuditCleanupPresetHistoryEntry) {
    this.presetHistory.unshift(entry);
    if (this.presetHistory.length > this.presetHistoryMaxSize) {
      this.presetHistory.length = this.presetHistoryMaxSize;
    }
  }
}

const singleton = new AuditCleanupScheduler();

export function startAuditCleanupScheduler() {
  singleton.start();
}

export function getAuditCleanupScheduler() {
  return singleton;
}
