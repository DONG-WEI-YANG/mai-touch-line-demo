import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  REQUIRED_DATABASE_TABLES,
  checkDatabaseIntegrity,
  type DatabaseIntegrityAdapter,
} from "../../src/server/services/databaseIntegrity";

const openDatabases: Database.Database[] = [];

function sqliteAdapter(db: Database.Database): DatabaseIntegrityAdapter {
  return {
    type: "sqlite",
    rawSqlite: db,
    probe: async () => { db.prepare("SELECT 1").get(); },
    listTables: async () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name),
  };
}

function databaseWithRequiredTables(): Database.Database {
  const db = new Database(":memory:");
  openDatabases.push(db);
  for (const table of REQUIRED_DATABASE_TABLES) {
    db.exec(`CREATE TABLE "${table}" (id INTEGER PRIMARY KEY)`);
  }
  return db;
}

afterEach(() => {
  while (openDatabases.length) openDatabases.pop()?.close();
});

describe("checkDatabaseIntegrity", () => {
  it("reports a healthy SQLite database only after real PRAGMA and table checks", async () => {
    const db = databaseWithRequiredTables();

    const report = await checkDatabaseIntegrity({ connect: async () => sqliteAdapter(db) });

    expect(report).toMatchObject({
      status: "healthy",
      dialect: "sqlite",
      checks: {
        connectivity: "passed",
        quickCheck: "passed",
        foreignKeys: "passed",
        requiredTables: "passed",
      },
      issues: [],
    });
    expect(report.checkedAt).toEqual(expect.any(Number));
    expect(report.durationMs).toEqual(expect.any(Number));
  });

  it("reports every missing required table without creating it", async () => {
    const db = new Database(":memory:");
    openDatabases.push(db);

    const report = await checkDatabaseIntegrity({ connect: async () => sqliteAdapter(db) });

    expect(report.status).toBe("degraded");
    expect(report.checks.requiredTables).toBe("failed");
    expect(report.issues).toContainEqual({
      code: "DB_REQUIRED_TABLES_MISSING",
      message: `${REQUIRED_DATABASE_TABLES.length} required database tables are missing`,
      details: [...REQUIRED_DATABASE_TABLES],
    });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([]);
  });

  it("reports foreign-key violations from SQLite", async () => {
    const db = databaseWithRequiredTables();
    db.exec("CREATE TABLE parent_ref (id INTEGER PRIMARY KEY)");
    db.exec("CREATE TABLE child_ref (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent_ref(id))");
    db.pragma("foreign_keys = OFF");
    db.exec("INSERT INTO child_ref (id, parent_id) VALUES (1, 999)");
    db.pragma("foreign_keys = ON");

    const report = await checkDatabaseIntegrity({ connect: async () => sqliteAdapter(db) });

    expect(report.status).toBe("degraded");
    expect(report.checks.foreignKeys).toBe("failed");
    expect(report.issues).toContainEqual({
      code: "DB_FOREIGN_KEY_VIOLATIONS",
      message: "1 foreign-key violation was found",
      details: ["child_ref"],
    });
  });

  it("reports a failed quick check without leaking raw database output", async () => {
    const adapter: DatabaseIntegrityAdapter = {
      type: "sqlite",
      rawSqlite: {
        pragma(source: string) {
          return source === "quick_check" ? [{ quick_check: "page 7 secret-content" }] : [];
        },
      },
      probe: async () => undefined,
      listTables: async () => [...REQUIRED_DATABASE_TABLES],
    };

    const report = await checkDatabaseIntegrity({ connect: async () => adapter });

    expect(report.status).toBe("degraded");
    expect(report.checks.quickCheck).toBe("failed");
    expect(JSON.stringify(report)).not.toContain("secret-content");
  });

  it("classifies a connection failure as unavailable with a safe issue", async () => {
    const report = await checkDatabaseIntegrity({
      connect: async () => { throw new Error("postgres://admin:secret@host/db"); },
    });

    expect(report).toMatchObject({
      status: "unavailable",
      dialect: "unknown",
      checks: { connectivity: "failed" },
      issues: [{ code: "DB_UNAVAILABLE", message: "Database connection or integrity check failed" }],
    });
    expect(JSON.stringify(report)).not.toContain("admin:secret");
  });
});
