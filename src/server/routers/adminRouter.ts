import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { hardwareGatewayService } from "../services/hardwareGatewayService";
import { ENV } from "../_core/env";
import {
  getAuditCleanupScheduler,
  type AuditCleanupPolicyEnvelope,
} from "../audit-cleanup-scheduler";
import {
  getBatchControlAuditLog,
  type BatchControlAuditResult,
  type PinVerificationState,
} from "../batch-control-audit";

const NLP_BASE_URL = process.env.NLP_SERVICE_URL ?? "http://localhost:8000";
const DEFAULT_NLP_TIMEOUT_MS = 3000;
const NLP_HEALTH_FALLBACK: NlpHealthResponse = {
  status: "offline",
  error: "NLP Service unreachable",
};
const MODEL_DOWNLOADS_FALLBACK: ModelDownloadsResponse = {
  total_models: 120,
  downloaded_models: 0,
  status: "error",
};

type NlpHealthResponse = {
  status?: string;
  error?: string;
  mode?: string;
  pool_stats?: {
    avg_latency_ms?: number;
  };
};

type ModelDownloadsResponse = {
  total_models?: number;
  downloaded_models?: number;
  status?: string;
};

async function fetchJsonWithFallback<T>(
  path: string,
  fallback: T,
  timeoutMs: number = DEFAULT_NLP_TIMEOUT_MS,
): Promise<T> {
  const url = `${NLP_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return fallback;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return fallback;
  }
}

function normalizeDeviceStatus(status: string): string {
  return status.trim();
}

const DEVICE_TYPES = [
  "light",
  "climate",
  "curtain",
  "security",
  "media",
  "power",
] as const;
type DeviceType = (typeof DEVICE_TYPES)[number];
type RiskLevel = "low" | "medium" | "high";
type PermissionTier = "L1" | "L2" | "L3";

const PERMISSION_WEIGHT: Record<PermissionTier, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
};

const DEFAULT_BATCH_CONTROL_PIN = "2468";

function evaluateBulkControlRisk(input: {
  status: string;
  deviceType: DeviceType;
  targetDeviceCount: number;
}) {
  const reasons: string[] = [];
  let riskLevel: RiskLevel = "low";

  if (input.deviceType === "security" || input.deviceType === "power") {
    reasons.push("sensitive-device-type");
    riskLevel = "high";
  }
  if (input.targetDeviceCount >= 8) {
    reasons.push("large-batch-size");
    riskLevel = "high";
  }
  if (input.status === "off" && input.targetDeviceCount >= 3) {
    reasons.push("multi-device-shutdown");
    riskLevel = "high";
  }
  if (riskLevel !== "high") {
    if (input.targetDeviceCount >= 4) {
      reasons.push("medium-batch-size");
      riskLevel = "medium";
    }
    if (input.status === "off") {
      reasons.push("single-batch-shutdown");
      riskLevel = "medium";
    }
  }
  const requiredPermissionTier: PermissionTier =
    riskLevel === "high" ? "L3" : riskLevel === "medium" ? "L2" : "L1";
  const requiresPin = riskLevel === "high";

  return {
    riskLevel,
    reasons,
    requiredPermissionTier,
    requiresPin,
    targetDeviceCount: input.targetDeviceCount,
  };
}

function getAdminPermissionTier(openId: string | null | undefined): PermissionTier {
  return openId && ENV.ownerOpenId && openId === ENV.ownerOpenId ? "L3" : "L2";
}

function ensurePermissionTier(granted: PermissionTier, required: PermissionTier) {
  if (PERMISSION_WEIGHT[granted] < PERMISSION_WEIGHT[required]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "INSUFFICIENT_BATCH_PERMISSION",
    });
  }
}

function verifyBatchControlPin(pin: string | undefined) {
  const expectedPin = (process.env.ADMIN_BATCH_CONTROL_PIN ?? DEFAULT_BATCH_CONTROL_PIN).trim();
  const normalizedPin = (pin ?? "").trim();
  if (!normalizedPin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "PIN_REQUIRED",
    });
  }
  if (normalizedPin !== expectedPin) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "INVALID_PIN",
    });
  }
}

function extractAuditError(error: unknown): {
  result: BatchControlAuditResult;
  errorCode?: string;
  errorMessage?: string;
} {
  if (error instanceof TRPCError) {
    return {
      result:
        error.code === "FORBIDDEN" ||
        error.code === "UNAUTHORIZED" ||
        error.code === "BAD_REQUEST"
          ? "rejected"
          : "failed",
      errorCode: error.code,
      errorMessage: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      result: "failed",
      errorMessage: error.message,
    };
  }
  return {
    result: "failed",
    errorMessage: "Unknown bulk control error",
  };
}

function ensureCleanupPolicyWriteAccess(openId: string | null | undefined) {
  const policy = getAuditCleanupScheduler().getPolicyConfig();
  if (!policy.lockMode) return;
  if (!ENV.ownerOpenId || !openId || openId !== ENV.ownerOpenId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "CLEANUP_POLICY_LOCKED",
    });
  }
}

export const adminDashboardRouter = router({
  stats: adminProcedure.query(async () => db.getDashboardStats()),
  users: adminProcedure.query(async () => db.getAllUsers()),
  hardwareGatewayHealth: adminProcedure.query(() =>
    hardwareGatewayService.getHealthInfo(),
  ),
  hardwareDispatchHistory: adminProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(200).optional(),
      }),
    )
    .query(({ input }) =>
      hardwareGatewayService.getDispatchHistory(input.limit),
    ),
  amenityDevices: adminProcedure
    .input(z.object({ amenityId: z.number().optional() }))
    .query(async ({ input }) => db.getDevicesByAmenity(input.amenityId)),
  controlDevice: adminProcedure
    .input(
      z.object({
        deviceId: z.number().int().positive(),
        status: z.string().min(1).max(64),
      }),
    )
    .mutation(async ({ input }) => {
      const device = await db.getDeviceById(input.deviceId);
      if (!device) {
        throw new Error("Device not found");
      }

      const status = normalizeDeviceStatus(input.status);
      if (!status) {
        throw new Error("Invalid device status");
      }

      const dispatchResult = await hardwareGatewayService.dispatchDeviceCommand({
        deviceId: device.id,
        status,
        requestedBy: "adminDashboard.controlDevice",
        deviceName: device.name,
        deviceType: device.type,
        amenityId: device.amenityId,
        unitId: device.unitId,
      });
      if (!dispatchResult.success) {
        throw new Error(dispatchResult.reason ?? "Failed to dispatch hardware command");
      }

      await db.updateDeviceStatus(input.deviceId, status);
      return {
        success: true as const,
        deviceId: input.deviceId,
        status,
        dispatch: dispatchResult,
      };
    }),
  bulkControlDevices: adminProcedure
    .input(
      z.object({
        amenityId: z.number().int().positive(),
        deviceType: z.enum(DEVICE_TYPES),
        status: z.string().min(1).max(64),
        verificationPin: z.string().trim().min(4).max(12).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const status = normalizeDeviceStatus(input.status);
      const amenityDevices = await db.getDevicesByAmenity(input.amenityId);
      const devices = amenityDevices.filter(
        (device) => device.type === input.deviceType,
      );
      const risk = evaluateBulkControlRisk({
        status,
        deviceType: input.deviceType,
        targetDeviceCount: devices.length,
      });
      const grantedPermissionTier = getAdminPermissionTier(ctx.user?.openId);
      let effectivePermissionTier: PermissionTier = grantedPermissionTier;
      let pinVerification: PinVerificationState = risk.requiresPin
        ? "missing"
        : "not_required";
      let dispatchedCount = 0;
      let fallbackCount = 0;

      try {
        if (!status) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid device status",
          });
        }
        if (devices.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No devices found for amenity ${input.amenityId} with type ${input.deviceType}`,
          });
        }

        if (risk.requiresPin) {
          const hasPin = Boolean(input.verificationPin?.trim());
          pinVerification = hasPin ? "failed" : "missing";
          verifyBatchControlPin(input.verificationPin);
          pinVerification = "passed";
          effectivePermissionTier = "L3";
        }
        ensurePermissionTier(effectivePermissionTier, risk.requiredPermissionTier);

        const dispatchResults = await Promise.all(
          devices.map(async (device) => ({
            deviceId: device.id,
            result: await hardwareGatewayService.dispatchDeviceCommand({
              deviceId: device.id,
              status,
              requestedBy: "adminDashboard.bulkControlDevices",
              deviceName: device.name,
              deviceType: device.type,
              amenityId: device.amenityId,
              unitId: device.unitId,
            }),
          })),
        );

        const failedDispatch = dispatchResults.find((item) => !item.result.success);
        if (failedDispatch) {
          throw new Error(
            failedDispatch.result.reason ??
              `Failed to dispatch hardware command for device ${failedDispatch.deviceId}`,
          );
        }

        for (const device of devices) {
          await db.updateDeviceStatus(device.id, status);
        }

        fallbackCount = dispatchResults.filter(
          (item) => item.result.fallbackUsed,
        ).length;
        dispatchedCount = dispatchResults.filter(
          (item) => item.result.commandDispatched,
        ).length;

        await getBatchControlAuditLog().record({
          adminOpenId: ctx.user?.openId ?? null,
          amenityId: input.amenityId,
          deviceType: input.deviceType,
          status,
          targetDeviceCount: devices.length,
          riskLevel: risk.riskLevel,
          riskReasons: risk.reasons,
          requiredPermissionTier: risk.requiredPermissionTier,
          grantedPermissionTier,
          effectivePermissionTier,
          pinRequired: risk.requiresPin,
          pinVerification,
          result: "success",
          dispatchedCount,
          fallbackCount,
        });

        return {
          success: true as const,
          affected: devices.length,
          amenityId: input.amenityId,
          deviceType: input.deviceType,
          status,
          risk,
          grantedPermissionTier,
          effectivePermissionTier,
          pinVerification,
          dispatchedCount,
          fallbackCount,
        };
      } catch (error) {
        const auditError = extractAuditError(error);
        await getBatchControlAuditLog().record({
          adminOpenId: ctx.user?.openId ?? null,
          amenityId: input.amenityId,
          deviceType: input.deviceType,
          status: status || input.status,
          targetDeviceCount: devices.length,
          riskLevel: risk.riskLevel,
          riskReasons: risk.reasons,
          requiredPermissionTier: risk.requiredPermissionTier,
          grantedPermissionTier,
          effectivePermissionTier,
          pinRequired: risk.requiresPin,
          pinVerification,
          result: auditError.result,
          dispatchedCount,
          fallbackCount,
          errorCode: auditError.errorCode,
          errorMessage: auditError.errorMessage,
        });
        throw error;
      }
    }),
  bulkControlAuditLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(200).optional(),
        offset: z.number().int().min(0).optional(),
        amenityId: z.number().int().positive().optional(),
        riskLevel: z.enum(["low", "medium", "high"]).optional(),
        result: z.enum(["success", "rejected", "failed"]).optional(),
      }),
    )
    .query(async ({ input }) => getBatchControlAuditLog().query(input)),
  auditRetentionPolicy: adminProcedure.query(async () => {
    const policy = db.getBatchControlAuditRetentionPolicy();
    const preview = await db.cleanupBatchControlAuditLogs({ ...policy, dryRun: true });
    return {
      policy,
      preview,
    };
  }),
  cleanupAuditLogs: adminProcedure
    .input(
      z.object({
        retentionDays: z.number().int().min(1).max(3650).optional(),
        maxRecords: z.number().int().min(1).max(1_000_000).optional(),
        dryRun: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) =>
      db.cleanupBatchControlAuditLogs({
        retentionDays: input.retentionDays,
        maxRecords: input.maxRecords,
        dryRun: input.dryRun ?? false,
      }),
    ),
  auditCleanupSchedulerStatus: adminProcedure.query(() =>
    getAuditCleanupScheduler().getStatus(),
  ),
  auditCleanupPolicyStatus: adminProcedure.query(() =>
    getAuditCleanupScheduler().getPolicyConfig(),
  ),
  setAuditCleanupScheduler: adminProcedure
    .input(
      z
        .object({
          enabled: z.boolean().optional(),
          intervalMinutes: z.number().int().min(1).max(10_080).optional(),
          failureThreshold: z.number().int().min(1).max(1_000).optional(),
          consecutiveFailureThreshold: z.number().int().min(1).max(1_000).optional(),
        })
        .refine(
          (value) =>
            value.enabled !== undefined ||
            value.intervalMinutes !== undefined ||
            value.failureThreshold !== undefined ||
            value.consecutiveFailureThreshold !== undefined,
          { message: "At least one field is required" },
        ),
    )
    .mutation(({ input, ctx }) => {
      ensureCleanupPolicyWriteAccess(ctx.user?.openId);
      return getAuditCleanupScheduler().configure({
        enabled: input.enabled,
        intervalMinutes: input.intervalMinutes,
        failureThreshold: input.failureThreshold,
        consecutiveFailureThreshold: input.consecutiveFailureThreshold,
      }, ctx.user?.openId ?? null);
    }),
  applyAuditCleanupAlertPreset: adminProcedure
    .input(
      z.object({
        preset: z.enum(["conservative", "balanced", "aggressive"]),
      }),
    )
    .mutation(({ input, ctx }) => {
      ensureCleanupPolicyWriteAccess(ctx.user?.openId);
      return getAuditCleanupScheduler().applyAlertPreset(input.preset, ctx.user?.openId ?? null);
    }),
  setAuditCleanupPolicyLockMode: adminProcedure
    .input(
      z.object({
        lockMode: z.boolean(),
      }),
    )
    .mutation(({ input, ctx }) => {
      if (!ENV.ownerOpenId || !ctx.user?.openId || ctx.user.openId !== ENV.ownerOpenId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "OWNER_REQUIRED",
        });
      }
      return getAuditCleanupScheduler().setLockMode(input.lockMode);
    }),
  exportAuditCleanupPolicy: adminProcedure.query(() => {
    return getAuditCleanupScheduler().exportPolicyConfig();
  }),
  importAuditCleanupPolicy: adminProcedure
    .input(
      z.union([
        z.object({
          enabled: z.boolean().optional(),
          intervalMinutes: z.number().int().min(1).max(10_080).optional(),
          failureThreshold: z.number().int().min(1).max(1_000).optional(),
          consecutiveFailureThreshold: z.number().int().min(1).max(1_000).optional(),
          lockMode: z.boolean().optional(),
        }),
        z.object({
          config: z.object({
            enabled: z.boolean(),
            intervalMinutes: z.number(),
            failureThreshold: z.number(),
            consecutiveFailureThreshold: z.number(),
            lockMode: z.boolean(),
          }),
          timestamp: z.number(),
          signature: z.string(),
        }) as z.ZodType<AuditCleanupPolicyEnvelope>,
      ]),
    )
    .mutation(({ input, ctx }) => {
      ensureCleanupPolicyWriteAccess(ctx.user?.openId);
      return getAuditCleanupScheduler().importPolicyConfig(input);
    }),
  auditCleanupAlertPresets: adminProcedure.query(() =>
    getAuditCleanupScheduler().getAlertPresets(),
  ),
  auditCleanupPresetHistory: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(500).optional(),
      }),
    )
    .query(({ input }) =>
      getAuditCleanupScheduler().getPresetHistory(input.limit ?? 20),
    ),
  rollbackAuditCleanupAlertPreset: adminProcedure.mutation(({ ctx }) => {
    ensureCleanupPolicyWriteAccess(ctx.user?.openId);
    return getAuditCleanupScheduler().rollbackToPreviousPreset(ctx.user?.openId ?? null);
  }),
  runAuditCleanupNow: adminProcedure
    .input(
      z.object({
        retentionDays: z.number().int().min(1).max(3650).optional(),
        maxRecords: z.number().int().min(1).max(1_000_000).optional(),
      }),
    )
    .mutation(async ({ input }) =>
      getAuditCleanupScheduler().runNow({
        retentionDays: input.retentionDays,
        maxRecords: input.maxRecords,
      }),
    ),
  auditCleanupRunReports: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(500).optional(),
      }),
    )
    .query(({ input }) =>
      getAuditCleanupScheduler().getRunReports(input.limit),
    ),
  auditCleanupRunSummary: adminProcedure
    .input(
      z.object({
        windowHours: z.number().int().min(1).max(24 * 30).optional(),
      }),
    )
    .query(({ input }) =>
      getAuditCleanupScheduler().getRunSummary(input.windowHours ?? 24),
    ),
  auditCleanupAlertStatus: adminProcedure
    .input(
      z.object({
        windowHours: z.number().int().min(1).max(24 * 30).optional(),
      }),
    )
    .query(({ input }) =>
      getAuditCleanupScheduler().getAlertStatus(input.windowHours ?? 24),
    ),
  bulkControlRiskPreview: adminProcedure
    .input(
      z.object({
        amenityId: z.number().int().positive(),
        deviceType: z.enum(DEVICE_TYPES),
        status: z.string().min(1).max(64),
      }),
    )
    .query(async ({ input }) => {
      const status = normalizeDeviceStatus(input.status);
      if (!status) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid device status",
        });
      }
      const amenityDevices = await db.getDevicesByAmenity(input.amenityId);
      const devices = amenityDevices.filter(
        (device) => device.type === input.deviceType,
      );
      const risk = evaluateBulkControlRisk({
        status,
        deviceType: input.deviceType,
        targetDeviceCount: devices.length,
      });
      return {
        amenityId: input.amenityId,
        deviceType: input.deviceType,
        status,
        targetDeviceCount: devices.length,
        riskLevel: risk.riskLevel,
        reasons: risk.reasons,
        requiredPermissionTier: risk.requiredPermissionTier,
        requiresPin: risk.requiresPin,
      };
    }),

  nlpHealth: adminProcedure.query(async () =>
    fetchJsonWithFallback<NlpHealthResponse>("/health", NLP_HEALTH_FALLBACK),
  ),

  modelDownloads: adminProcedure.query(async () =>
    fetchJsonWithFallback<ModelDownloadsResponse>(
      "/models/stats",
      MODEL_DOWNLOADS_FALLBACK,
    ),
  ),
});
