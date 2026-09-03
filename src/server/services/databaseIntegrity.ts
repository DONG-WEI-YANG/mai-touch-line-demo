import { dbManager, type DatabaseType } from "../database/adapter";

export const REQUIRED_DATABASE_TABLES = [
  "users",
  "amenities",
  "bookings",
  "work_orders",
  "chat_messages",
  "sessions",
  "units",
  "devices",
  "access_passes",
  "wallets",
  "transactions",
  "access_logs",
  "batch_control_audit_logs",
  "system_jobs",
  "line_user",
  "line_message_log",
  "runtime_config",
  "demo_script_config",
  "web_tokens",
  "bind_codes",
  "line_sessions",
  "announcements",
  "packages",
  "parking_spots",
  "parking_assignments",
  "invoices",
] as const;

type CheckResult = "passed" | "failed" | "not_applicable" | "not_run";
export type DatabaseIntegrityStatus = "healthy" | "degraded" | "unavailable";

interface SqliteIntegrityHandle {
  pragma(source: string): unknown;
}

export interface DatabaseIntegrityAdapter {
  type: DatabaseType;
  rawSqlite?: SqliteIntegrityHandle;
  probe(): Promise<void>;
  listTables(): Promise<string[]>;
}

export interface DatabaseIntegrityDependencies {
  connect(): Promise<DatabaseIntegrityAdapter>;
}

export interface DatabaseIntegrityIssue {
  code:
    | "DB_UNAVAILABLE"
    | "DB_QUICK_CHECK_FAILED"
    | "DB_FOREIGN_KEY_VIOLATIONS"
    | "DB_REQUIRED_TABLES_MISSING"
    | "DB_SQLITE_HANDLE_UNAVAILABLE";
  message: string;
  details?: string[];
}

export interface DatabaseIntegrityReport {
  status: DatabaseIntegrityStatus;
  dialect: DatabaseType | "unknown";
  checkedAt: number;
  durationMs: number;
  checks: {
    connectivity: CheckResult;
    quickCheck: CheckResult;
    foreignKeys: CheckResult;
    requiredTables: CheckResult;
  };
  issues: DatabaseIntegrityIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function quickCheckPassed(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) return false;
  return Object.values(value[0]).some((entry) => entry === "ok");
}

function foreignKeyTables(value: unknown): string[] {
  if (!Array.isArray(value)) return ["unknown"];
  return [...new Set(value.map((row) => (
    isRecord(row) && typeof row.table === "string" ? row.table : "unknown"
  )))];
}

async function inspectDatabase(deps: DatabaseIntegrityDependencies): Promise<Omit<DatabaseIntegrityReport, "checkedAt" | "durationMs">> {
  const adapter = await deps.connect();
  await adapter.probe();
  const issues: DatabaseIntegrityIssue[] = [];
  const checks: DatabaseIntegrityReport["checks"] = {
    connectivity: "passed",
    quickCheck: "not_applicable",
    foreignKeys: "not_applicable",
    requiredTables: "not_run",
  };

  if (adapter.type === "sqlite") {
    if (!adapter.rawSqlite) {
      checks.quickCheck = "failed";
      checks.foreignKeys = "failed";
      issues.push({
        code: "DB_SQLITE_HANDLE_UNAVAILABLE",
        message: "SQLite integrity handle is unavailable",
      });
    } else {
      const quickCheck = adapter.rawSqlite.pragma("quick_check");
      checks.quickCheck = quickCheckPassed(quickCheck) ? "passed" : "failed";
      if (checks.quickCheck === "failed") {
        issues.push({
          code: "DB_QUICK_CHECK_FAILED",
          message: "SQLite quick integrity check failed",
        });
      }

      const foreignKeyCheck = adapter.rawSqlite.pragma("foreign_key_check");
      const violatingTables = foreignKeyTables(foreignKeyCheck);
      checks.foreignKeys = violatingTables.length === 0 ? "passed" : "failed";
      if (violatingTables.length > 0) {
        issues.push({
          code: "DB_FOREIGN_KEY_VIOLATIONS",
          message: `${violatingTables.length} foreign-key ${violatingTables.length === 1 ? "violation was" : "violations were"} found`,
          details: violatingTables,
        });
      }
    }
  }

  const tables = new Set(await adapter.listTables());
  const missing = REQUIRED_DATABASE_TABLES.filter((table) => !tables.has(table));
  checks.requiredTables = missing.length === 0 ? "passed" : "failed";
  if (missing.length > 0) {
    issues.push({
      code: "DB_REQUIRED_TABLES_MISSING",
      message: `${missing.length} required database ${missing.length === 1 ? "table is" : "tables are"} missing`,
      details: [...missing],
    });
  }

  return {
    status: issues.length === 0 ? "healthy" : "degraded",
    dialect: adapter.type,
    checks,
    issues,
  };
}

export async function checkDatabaseIntegrity(
  deps: DatabaseIntegrityDependencies = { connect: () => dbManager.connect() },
  timeoutMs = 5_000,
): Promise<DatabaseIntegrityReport> {
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      inspectDatabase(deps),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("database integrity deadline exceeded")), timeoutMs);
      }),
    ]);
    return {
      ...result,
      checkedAt: Date.now(),
      durationMs: Date.now() - startedAt,
    };
  } catch {
    return {
      status: "unavailable",
      dialect: "unknown",
      checkedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      checks: {
        connectivity: "failed",
        quickCheck: "not_run",
        foreignKeys: "not_run",
        requiredTables: "not_run",
      },
      issues: [{
        code: "DB_UNAVAILABLE",
        message: "Database connection or integrity check failed",
      }],
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
