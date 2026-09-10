import { describe, expect, it } from "vitest";

import { getSystemDiagnostics } from "../../src/server/services/systemDiagnostics";
import type { DatabaseIntegrityReport } from "../../src/server/services/databaseIntegrity";
import type { LLMHealthReport } from "../../src/server/_core/llm";

const healthyDatabase: DatabaseIntegrityReport = {
  status: "healthy",
  dialect: "sqlite",
  checkedAt: 100,
  durationMs: 2,
  checks: {
    connectivity: "passed",
    quickCheck: "passed",
    foreignKeys: "passed",
    requiredTables: "passed",
  },
  issues: [],
};

const healthyAi: LLMHealthReport = {
  status: "healthy",
  configured: true,
  reachable: true,
  checkedAt: 101,
  latencyMs: 8,
};

describe("getSystemDiagnostics", () => {
  it('does not mark the core service degraded solely for disabled optional NLP',async()=>{
    const report=await getSystemDiagnostics({database:async()=>healthyDatabase,ai:async()=>healthyAi,nlp:async()=>({status:'unconfigured',configured:false,reachable:false,latencyMs:0}),runtime:()=>({nodeVersion:'v24',environment:'demo',appVersion:'1'}),now:()=>1});
    expect(report.overall).toBe('healthy');
    expect(report.services.nlp.status).toBe('unconfigured');
  });
  it("reports healthy only when every configured service passes a real check", async () => {
    const report = await getSystemDiagnostics({
      database: async () => healthyDatabase,
      ai: async () => healthyAi,
      nlp: async () => ({ status: "healthy", configured: true, reachable: true, latencyMs: 4 }),
      runtime: () => ({ nodeVersion: "v24.18.0", environment: "test", appVersion: "1.0.0" }),
      now: () => 1_725_000_000_000,
    });

    expect(report).toEqual({
      overall: "healthy",
      checkedAt: 1_725_000_000_000,
      services: {
        database: healthyDatabase,
        ai: healthyAi,
        nlp: { status: "healthy", configured: true, reachable: true, latencyMs: 4 },
      },
      runtime: { nodeVersion: "v24.18.0", environment: "test", appVersion: "1.0.0" },
    });
  });

  it("keeps optional unconfigured and unreachable services honest and degrades the aggregate", async () => {
    const report = await getSystemDiagnostics({
      database: async () => healthyDatabase,
      ai: async () => ({ ...healthyAi, status: "unconfigured", configured: false, reachable: false }),
      nlp: async () => ({ status: "unavailable", configured: true, reachable: false, latencyMs: 3000, code: "unreachable" }),
      runtime: () => ({ nodeVersion: "v24.18.0", environment: "production", appVersion: "1.0.0" }),
      now: () => 200,
    });

    expect(report.overall).toBe("degraded");
    expect(report.services.ai.status).toBe("unconfigured");
    expect(report.services.nlp).toEqual({
      status: "unavailable",
      configured: true,
      reachable: false,
      latencyMs: 3000,
      code: "unreachable",
    });
    expect(report).not.toHaveProperty("services.forge_api");
    expect(report).not.toHaveProperty("services.nlp_engine.url");
  });

  it("marks the aggregate unavailable when the critical database is unavailable", async () => {
    const report = await getSystemDiagnostics({
      database: async () => ({ ...healthyDatabase, status: "unavailable", dialect: "unknown" }),
      ai: async () => healthyAi,
      nlp: async () => ({ status: "healthy", configured: true, reachable: true, latencyMs: 1 }),
      runtime: () => ({ nodeVersion: "v24", environment: "test", appVersion: "1.0.0" }),
      now: () => 300,
    });

    expect(report.overall).toBe("unavailable");
  });
});
