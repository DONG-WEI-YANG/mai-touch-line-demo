import { ENV } from "../_core/env";
import { checkLLMHealth, type LLMHealthReport } from "../_core/llm";
import { checkNLPHealth } from "../_core/nlpClient";
import {
  checkDatabaseIntegrity,
  type DatabaseIntegrityReport,
} from "./databaseIntegrity";

export type ServiceHealthStatus = "healthy" | "degraded" | "unavailable" | "unconfigured";

export interface NlpDiagnostic {
  status: ServiceHealthStatus;
  configured: boolean;
  reachable: boolean;
  latencyMs: number;
  code?: string;
}

export interface RuntimeDiagnostic {
  nodeVersion: string;
  environment: string;
  appVersion: string;
}

export interface SystemDiagnosticsDependencies {
  database(): Promise<DatabaseIntegrityReport>;
  ai(): Promise<LLMHealthReport>;
  nlp(): Promise<NlpDiagnostic>;
  runtime(): RuntimeDiagnostic;
  now(): number;
}

export interface SystemDiagnosticsReport {
  overall: "healthy" | "degraded" | "unavailable";
  checkedAt: number;
  services: {
    database: DatabaseIntegrityReport;
    ai: LLMHealthReport;
    nlp: NlpDiagnostic;
  };
  runtime: RuntimeDiagnostic;
}

async function defaultNlpDiagnostic(): Promise<NlpDiagnostic> {
  const startedAt = Date.now();
  if (!ENV.nlpServiceEnabled) {
    return {
      status: "unconfigured",
      configured: false,
      reachable: false,
      latencyMs: Date.now() - startedAt,
      code: "disabled",
    };
  }
  const result = await checkNLPHealth();
  return {
    status: result.available ? "healthy" : "unavailable",
    configured: true,
    reachable: result.available,
    latencyMs: Date.now() - startedAt,
    code: result.status,
  };
}

const defaultDependencies: SystemDiagnosticsDependencies = {
  database: () => checkDatabaseIntegrity(),
  ai: () => checkLLMHealth(),
  nlp: () => defaultNlpDiagnostic(),
  runtime: () => ({
    nodeVersion: process.version,
    environment: ENV.nodeEnv,
    appVersion: process.env.npm_package_version || "1.0.0",
  }),
  now: () => Date.now(),
};

export async function getSystemDiagnostics(
  deps: SystemDiagnosticsDependencies = defaultDependencies,
): Promise<SystemDiagnosticsReport> {
  const [database, ai, nlp] = await Promise.all([
    deps.database(),
    deps.ai(),
    deps.nlp(),
  ]);
  const overall = database.status === "unavailable"
    ? "unavailable"
    : database.status === "healthy" && ai.status === "healthy" && nlp.status === "healthy"
      ? "healthy"
      : "degraded";

  return {
    overall,
    checkedAt: deps.now(),
    services: { database, ai, nlp },
    runtime: deps.runtime(),
  };
}
