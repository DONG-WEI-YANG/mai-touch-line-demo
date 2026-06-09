import { and, desc, eq, lte, sql, count, inArray } from "drizzle-orm";
import {
  InsertUser, users,
  amenities, InsertAmenity,
  bookings, InsertBooking,
  workOrders, InsertWorkOrder,
  chatMessages, InsertChatMessage,
  sessions,
  units,
  devices,
  wallets,
  transactions,
  accessLogs,
  batchControlAuditLogs,
  systemJobs,
} from "./schema";
import { ENV } from "./_core/env";
import { dbManager } from "./database/adapter";
import type {
  BatchControlAuditEntry,
  BatchControlAuditRecordInput,
  BatchControlAuditResult,
  BatchControlRiskLevel,
} from "./batch-control-audit";

let cachedDb: Awaited<ReturnType<typeof dbManager.connect>>["db"] | null = null;

export async function getDb() {
  if (cachedDb) return cachedDb;
  try {
    const adapter = await dbManager.connect();
    cachedDb = adapter.db;
    return cachedDb;
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    return null;
  }
}

function isMissingAccessLogsTable(error: unknown): boolean {
  return error instanceof Error && /no such table: access_logs/i.test(error.message);
}

function isMissingDevicesTable(error: unknown): boolean {
  return error instanceof Error && /no such table: devices/i.test(error.message);
}

function isMissingUnitsTable(error: unknown): boolean {
  return error instanceof Error && /no such table: units/i.test(error.message);
}

function isMissingWalletsTable(error: unknown): boolean {
  return error instanceof Error && /no such table: wallets/i.test(error.message);
}

function isMissingTransactionsTable(error: unknown): boolean {
  return error instanceof Error && /no such table: transactions/i.test(error.message);
}

function isMissingSystemJobsTable(error: unknown): boolean {
  return error instanceof Error && /no such table: system_jobs/i.test(error.message);
}

/**
 * Normalize an INSERT result's generated id across dialects. better-sqlite3
 * returns `{ changes, lastInsertRowid }`; the mysql driver returns
 * `[{ insertId }]`. createWorkOrder/createBooking inline this check — this
 * helper is for the paths that previously assumed only the mysql shape.
 */
function insertedId(result: unknown): number {
  return Array.isArray(result)
    ? Number((result[0] as { insertId: number }).insertId)
    : Number((result as { lastInsertRowid: number }).lastInsertRowid);
}

async function ensureAccessLogsTable() {
  if (ENV.dbType !== "sqlite") return;
  const db = await getDb();
  if (!db) return;
  await db.run(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        passId INTEGER,
        entryPoint TEXT NOT NULL,
        result TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
  );
}

async function ensureDevicesTable() {
  if (ENV.dbType !== "sqlite") return;
  const db = await getDb();
  if (!db) return;
  await db.run(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unitId INTEGER,
        amenityId INTEGER,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'off',
        lastSeen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
  );
}

async function ensureUnitsTable() {
  if (ENV.dbType !== "sqlite") return;
  const db = await getDb();
  if (!db) return;
  await db.run(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unitNumber TEXT NOT NULL UNIQUE,
        floor INTEGER NOT NULL,
        wing TEXT,
        squareFootage INTEGER,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
  );
}

async function ensureWalletsTable() {
  if (ENV.dbType !== "sqlite") return;
  const db = await getDb();
  if (!db) return;
  await db.run(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL UNIQUE,
        balance INTEGER NOT NULL DEFAULT 0,
        points INTEGER NOT NULL DEFAULT 0,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
  );
}

async function ensureTransactionsTable() {
  if (ENV.dbType !== "sqlite") return;
  const db = await getDb();
  if (!db) return;
  await db.run(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        walletId INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'TWD',
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
  );
}

async function ensureSystemJobsTable() {
  if (ENV.dbType !== "sqlite") return;
  const db = await getDb();
  if (!db) return;
  await db.run(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS system_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER NOT NULL DEFAULT 0,
        currentStep TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
  );
}

type BatchControlAuditQuery = {
  limit?: number;
  offset?: number;
  amenityId?: number;
  riskLevel?: BatchControlRiskLevel;
  result?: BatchControlAuditResult;
};

type AccessLogInsert = typeof accessLogs.$inferInsert;
type SystemJobInsert = typeof systemJobs.$inferInsert;

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

export type BatchControlAuditRetentionPolicy = {
  retentionDays: number;
  maxRecords: number;
};

export type BatchControlAuditCleanupResult = {
  beforeCount: number;
  afterCount: number;
  deletedByDays: number;
  deletedByCount: number;
  totalDeleted: number;
  retentionDays: number;
  maxRecords: number;
  cutoffTimestamp: string;
  dryRun: boolean;
};

const DEFAULT_BATCH_AUDIT_RETENTION_DAYS = 90;
const DEFAULT_BATCH_AUDIT_MAX_RECORDS = 5000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getBatchControlAuditRetentionPolicy(): BatchControlAuditRetentionPolicy {
  return {
    retentionDays: parsePositiveInt(
      process.env.BATCH_AUDIT_RETENTION_DAYS,
      DEFAULT_BATCH_AUDIT_RETENTION_DAYS,
    ),
    maxRecords: parsePositiveInt(
      process.env.BATCH_AUDIT_MAX_RECORDS,
      DEFAULT_BATCH_AUDIT_MAX_RECORDS,
    ),
  };
}

function parseRiskReasons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapBatchAuditRowToEntry(row: typeof batchControlAuditLogs.$inferSelect): BatchControlAuditEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    adminOpenId: row.adminOpenId ?? null,
    amenityId: row.amenityId,
    deviceType: row.deviceType,
    status: row.status,
    targetDeviceCount: row.targetDeviceCount,
    riskLevel: row.riskLevel,
    riskReasons: parseRiskReasons(row.riskReasons),
    requiredPermissionTier: row.requiredPermissionTier,
    grantedPermissionTier: row.grantedPermissionTier,
    effectivePermissionTier: row.effectivePermissionTier,
    pinRequired: Boolean(row.pinRequired),
    pinVerification: row.pinVerification,
    result: row.result,
    dispatchedCount: row.dispatchedCount,
    fallbackCount: row.fallbackCount,
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
  };
}




export async function createBatchControlAuditLog(input: BatchControlAuditRecordInput): Promise<BatchControlAuditEntry | null> {
  const db = await getDb();
  if (!db) return null;

  const entry: BatchControlAuditEntry = {
    id: `bca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...input,
  };

  // SQLite can't bind JS booleans, and createdAt is defaultNow() → now() (which
  // SQLite lacks). Normalize both so the audit insert works under SQLite (same
  // class of fix as createAmenity's isActive → 1/0). Cast via Record because the
  // mysql-typed insert shape expects a boolean for pinRequired.
  const auditValues: Record<string, unknown> = {
    ...entry,
    createdAt: new Date(),
    pinRequired: entry.pinRequired ? 1 : 0,
    riskReasons: JSON.stringify(entry.riskReasons ?? []),
    adminOpenId: entry.adminOpenId ?? null,
    errorCode: entry.errorCode ?? null,
    errorMessage: entry.errorMessage ?? null,
  };
  await db.insert(batchControlAuditLogs).values(auditValues as typeof batchControlAuditLogs.$inferInsert);

  return entry;
}

export async function queryBatchControlAuditLogs(filters: BatchControlAuditQuery): Promise<{
  total: number;
  items: BatchControlAuditEntry[];
  stats: BatchControlAuditStats;
}> {
  const db = await getDb();
  if (!db) {
    const emptyStats: BatchControlAuditStats = {
      total: 0,
      successCount: 0,
      rejectedCount: 0,
      failedCount: 0,
      highRiskCount: 0,
      pinRequiredCount: 0,
      pinFailedCount: 0,
      last24hCount: 0,
    };
    return { total: 0, items: [], stats: emptyStats };
  }

  let whereClause:
    | ReturnType<typeof eq<typeof batchControlAuditLogs.amenityId>>
    | ReturnType<typeof eq<typeof batchControlAuditLogs.riskLevel>>
    | ReturnType<typeof eq<typeof batchControlAuditLogs.result>>
    | undefined;
  const appendCondition = (
    condition:
      | ReturnType<typeof eq<typeof batchControlAuditLogs.amenityId>>
      | ReturnType<typeof eq<typeof batchControlAuditLogs.riskLevel>>
      | ReturnType<typeof eq<typeof batchControlAuditLogs.result>>,
  ) => {
    whereClause = whereClause ? and(whereClause, condition) : condition;
  };
  if (filters.amenityId !== undefined) {
    appendCondition(eq(batchControlAuditLogs.amenityId, filters.amenityId));
  }
  if (filters.riskLevel) {
    appendCondition(eq(batchControlAuditLogs.riskLevel, filters.riskLevel));
  }
  if (filters.result) {
    appendCondition(eq(batchControlAuditLogs.result, filters.result));
  }
  const offset = Number.isFinite(filters.offset)
    ? Math.max(0, Math.trunc(filters.offset ?? 0))
    : 0;
  const limit = Number.isFinite(filters.limit)
    ? Math.max(1, Math.min(200, Math.trunc(filters.limit ?? 50)))
    : 50;

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [pagedRows, statsRows] = await Promise.all([
    // 1. Paged items query (unchanged)
    db
      .select()
      .from(batchControlAuditLogs)
      .where(whereClause)
      .orderBy(desc(batchControlAuditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    // 2. SQL aggregation for total + stats (replaces full-table scan)
    db
      .select({
        total: count(),
        successCount: sql<number>`SUM(CASE WHEN ${batchControlAuditLogs.result} = 'success' THEN 1 ELSE 0 END)`,
        rejectedCount: sql<number>`SUM(CASE WHEN ${batchControlAuditLogs.result} = 'rejected' THEN 1 ELSE 0 END)`,
        failedCount: sql<number>`SUM(CASE WHEN ${batchControlAuditLogs.result} = 'failed' THEN 1 ELSE 0 END)`,
        highRiskCount: sql<number>`SUM(CASE WHEN ${batchControlAuditLogs.riskLevel} = 'high' THEN 1 ELSE 0 END)`,
        pinRequiredCount: sql<number>`SUM(CASE WHEN ${batchControlAuditLogs.pinRequired} = 1 THEN 1 ELSE 0 END)`,
        pinFailedCount: sql<number>`SUM(CASE WHEN ${batchControlAuditLogs.pinVerification} IN ('failed', 'missing') THEN 1 ELSE 0 END)`,
        last24hCount: sql<number>`SUM(CASE WHEN ${batchControlAuditLogs.timestamp} >= ${cutoff24h} THEN 1 ELSE 0 END)`,
      })
      .from(batchControlAuditLogs)
      .where(whereClause),
  ]);

  const items = pagedRows.map(mapBatchAuditRowToEntry);
  const row = statsRows[0];
  const stats: BatchControlAuditStats = {
    total: Number(row?.total ?? 0),
    successCount: Number(row?.successCount ?? 0),
    rejectedCount: Number(row?.rejectedCount ?? 0),
    failedCount: Number(row?.failedCount ?? 0),
    highRiskCount: Number(row?.highRiskCount ?? 0),
    pinRequiredCount: Number(row?.pinRequiredCount ?? 0),
    pinFailedCount: Number(row?.pinFailedCount ?? 0),
    last24hCount: Number(row?.last24hCount ?? 0),
  };

  return {
    total: stats.total,
    items,
    stats,
  };
}

export async function cleanupBatchControlAuditLogs(input?: {
  retentionDays?: number;
  maxRecords?: number;
  dryRun?: boolean;
}): Promise<BatchControlAuditCleanupResult> {
  const db = await getDb();
  const policy = getBatchControlAuditRetentionPolicy();
  const retentionDays = Math.max(1, Math.trunc(input?.retentionDays ?? policy.retentionDays));
  const maxRecords = Math.max(1, Math.trunc(input?.maxRecords ?? policy.maxRecords));
  const dryRun = Boolean(input?.dryRun);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  if (!db) {
    return {
      beforeCount: 0,
      afterCount: 0,
      deletedByDays: 0,
      deletedByCount: 0,
      totalDeleted: 0,
      retentionDays,
      maxRecords,
      cutoffTimestamp: cutoffDate.toISOString(),
      dryRun,
    };
  }

  const countBeforeRows = await db.select({ count: count() }).from(batchControlAuditLogs);
  const beforeCount = Number(countBeforeRows[0]?.count ?? 0);

  const staleRows = await db
    .select({ id: batchControlAuditLogs.id })
    .from(batchControlAuditLogs)
    .where(lte(batchControlAuditLogs.createdAt, cutoffDate));
  const staleIds = staleRows.map((row: { id: number }) => row.id);
  const deletedByDays = staleIds.length;
  if (!dryRun && staleIds.length > 0) {
    await db
      .delete(batchControlAuditLogs)
      .where(inArray(batchControlAuditLogs.id, staleIds));
  }

  const rowsAfterDays = await db
    .select({ id: batchControlAuditLogs.id })
    .from(batchControlAuditLogs)
    .orderBy(desc(batchControlAuditLogs.createdAt));
  const overflowCount = Math.max(0, rowsAfterDays.length - maxRecords);
  const overflowIds = overflowCount > 0 ? rowsAfterDays.slice(maxRecords).map((row: { id: number }) => row.id) : [];
  const deletedByCount = overflowIds.length;
  if (!dryRun && overflowIds.length > 0) {
    await db
      .delete(batchControlAuditLogs)
      .where(inArray(batchControlAuditLogs.id, overflowIds));
  }

  const totalDeleted = deletedByDays + deletedByCount;
  const afterCount = dryRun
    ? Math.max(0, beforeCount - totalDeleted)
    : Number((await db.select({ count: count() }).from(batchControlAuditLogs))[0]?.count ?? 0);

  return {
    beforeCount,
    afterCount,
    deletedByDays,
    deletedByCount,
    totalDeleted,
    retentionDays,
    maxRecords,
    cutoffTimestamp: cutoffDate.toISOString(),
    dryRun,
  };
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    
    // Fallback explicitly to prevent Drizzle passing MySQL `now()` to SQLite dynamically
    if (!values.createdAt) values.createdAt = sql`CURRENT_TIMESTAMP` as unknown as Date;
    if (!values.updatedAt) values.updatedAt = sql`CURRENT_TIMESTAMP` as unknown as Date;
    if (!values.lastSignedIn) values.lastSignedIn = sql`CURRENT_TIMESTAMP` as unknown as Date;
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = sql`CURRENT_TIMESTAMP` as unknown as Date;
    
    const query = db.insert(users).values(values);
    if (typeof query.onDuplicateKeyUpdate === 'function') {
      await query.onDuplicateKeyUpdate({ set: updateSet });
    } else if (typeof query.onConflictDoUpdate === 'function') {
      await query.onConflictDoUpdate({ target: users.openId, set: updateSet });
    } else {
      // Manual fallback if query builder doesn't support either natively under `any` typing
      const existing = await db.select().from(users).where(eq(users.openId, values.openId)).limit(1);
      if (existing.length > 0) {
        await db.update(users).set(updateSet).where(eq(users.id, existing[0].id));
      } else {
        await db.insert(users).values(values);
      }
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.lastSignedIn));
}

export async function getUserCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(users);
  return result[0]?.count ?? 0;
}

// ─── Amenities ───────────────────────────────────────────────────────────────

export async function getAllAmenities() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(amenities).orderBy(amenities.name);
}

export async function getAmenityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(amenities).where(eq(amenities.id, id)).limit(1);
  return result[0];
}

export async function createAmenity(data: InsertAmenity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values = data as Record<string, unknown>;
  if (!values.createdAt) values.createdAt = sql`CURRENT_TIMESTAMP`;
  if (!values.updatedAt) values.updatedAt = sql`CURRENT_TIMESTAMP`;
  // SQLite strict binding fix for MySQL booleans
  if (data.isActive === undefined || data.isActive === true) values.isActive = 1;
  else if (data.isActive === false) values.isActive = 0;
  
  const result = await db.insert(amenities).values(data);
  return Array.isArray(result) ? result[0].insertId : (result as { lastInsertRowid: number }).lastInsertRowid;
}

export async function updateAmenity(id: number, data: Partial<InsertAmenity>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(amenities).set(data).where(eq(amenities.id, id));
}

export async function deleteAmenity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(amenities).where(eq(amenities.id, id));
}

// ─── Bookings ───────────────────────────────────────────────────────────────

export async function getUserBookings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(eq(bookings.userId, userId)).orderBy(desc(bookings.date));
}

export async function getAllBookings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).orderBy(desc(bookings.createdAt));
}

export async function getBookingsByAmenityAndDate(amenityId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(
    and(eq(bookings.amenityId, amenityId), eq(bookings.date, date), eq(bookings.status, "confirmed"))
  );
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return rows[0];
}

export async function createBooking(data: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values = data as Record<string, unknown>;
  if (!values.createdAt) values.createdAt = sql`CURRENT_TIMESTAMP`;
  if (!values.updatedAt) values.updatedAt = sql`CURRENT_TIMESTAMP`;
  const result = await db.insert(bookings).values(data);
  return Array.isArray(result) ? result[0].insertId : (result as { lastInsertRowid: number }).lastInsertRowid;
}

export async function updateBookingStatus(id: number, status: "confirmed" | "pending" | "cancelled" | "completed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookings).set({ status }).where(eq(bookings.id, id));
}

export async function getBookingCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(bookings);
  return result[0]?.count ?? 0;
}

export async function getActiveBookingCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(bookings).where(eq(bookings.status, "confirmed"));
  return result[0]?.count ?? 0;
}

// ─── Work Orders ─────────────────────────────────────────────────────────────

export async function getUserWorkOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workOrders).where(eq(workOrders.userId, userId)).orderBy(desc(workOrders.createdAt));
}

export async function getAllWorkOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workOrders).orderBy(desc(workOrders.createdAt));
}

export async function createWorkOrder(data: InsertWorkOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values = data as Record<string, unknown>;
  if (!values.createdAt) values.createdAt = sql`CURRENT_TIMESTAMP`;
  if (!values.updatedAt) values.updatedAt = sql`CURRENT_TIMESTAMP`;
  const result = await db.insert(workOrders).values(data);
  return Array.isArray(result) ? result[0].insertId : (result as { lastInsertRowid: number }).lastInsertRowid;
}

export async function getWorkOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
  return rows[0];
}

export async function updateWorkOrder(id: number, data: Partial<InsertWorkOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workOrders).set(data).where(eq(workOrders.id, id));
}

export async function getWorkOrderCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(workOrders);
  return result[0]?.count ?? 0;
}

export async function getOpenWorkOrderCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(workOrders).where(eq(workOrders.status, "open"));
  return result[0]?.count ?? 0;
}

// ─── Chat Messages ───────────────────────────────────────────────────────────

export async function getUserChatMessages(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(desc(chatMessages.createdAt)).limit(limit);
}

export async function createChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values = data as Record<string, unknown>;
  // chat_messages.createdAt is defaultNow() → now() on SQLite. Match the
  // createBooking/createWorkOrder idiom and supply CURRENT_TIMESTAMP.
  if (!values.createdAt) values.createdAt = sql`CURRENT_TIMESTAMP`;
  const result = await db.insert(chatMessages).values(data);
  return insertedId(result);
}

export async function getChatMessageCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(chatMessages);
  return result[0]?.count ?? 0;
}

// ─── Admin Dashboard Stats ──────────────────────────────────────────────────

export async function getDashboardStats() {
  const [userCount, bookingCount, activeBookings, workOrderCount, openWorkOrders, messageCount] = await Promise.all([
    getUserCount(),
    getBookingCount(),
    getActiveBookingCount(),
    getWorkOrderCount(),
    getOpenWorkOrderCount(),
    getChatMessageCount(),
  ]);

  return {
    totalUsers: userCount,
    totalBookings: bookingCount,
    activeBookings,
    totalWorkOrders: workOrderCount,
    openWorkOrders,
    totalMessages: messageCount,
  };
}

export async function getBookingsWithDetails() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      booking: bookings,
      userName: users.name,
      userEmail: users.email,
      amenityName: amenities.name,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.userId, users.id))
    .leftJoin(amenities, eq(bookings.amenityId, amenities.id))
    .orderBy(desc(bookings.createdAt));
  return result;
}

export async function getWorkOrdersWithDetails() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      workOrder: workOrders,
      userName: users.name,
      userEmail: users.email,
    })
    .from(workOrders)
    .leftJoin(users, eq(workOrders.userId, users.id))
    .orderBy(desc(workOrders.createdAt));
  return result;
}

// ─── OAuth Sessions ─────────────────────────────────────────────────────────

export async function createSession(data: { userId: number; provider: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const sessionToken = require('crypto').randomBytes(32).toString('hex');
  
  await db.insert(sessions).values({
    token: sessionToken,
    userId: data.userId,
    provider: data.provider,
    expiresAt: data.expiresAt,
    createdAt: new Date(),
  });
  
  return sessionToken;
}

export async function getSession(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  return result[0];
}

export async function updateSession(token: string, data: Partial<{ expiresAt: Date }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sessions).set(data).where(eq(sessions.token, token));
}

export async function deleteSession(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function cleanupExpiredSessions() {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
}

// ─── OAuth Users ────────────────────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db
      .select({
        user: users,
        unit: units,
      })
      .from(users)
      .leftJoin(units, eq(users.unitId, units.id))
      .where(eq(users.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    return {
      ...result[0].user,
      unitNumber: result[0].unit?.unitNumber || "Unassigned",
    };
  } catch (error) {
    if (!isMissingUnitsTable(error)) throw error;
    await ensureUnitsTable();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (result.length === 0) return undefined;
    return {
      ...result[0],
      unitNumber: "Unassigned",
    };
  }
}

export async function createUser(data: {
  email: string;
  name: string;
  picture?: string;
  loginMethod: string;
  openId: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const now = new Date();
  const result = await db.insert(users).values({
    email: data.email,
    name: data.name,
    picture: data.picture,
    loginMethod: data.loginMethod,
    openId: data.openId,
    lastSignedIn: now,
    // createdAt/updatedAt are declared defaultNow() in the (mysql) schema, which
    // emits now() — a function SQLite doesn't have. Pass explicit Dates so the
    // insert never relies on the server-side default. See [[migrations-at-boot]]
    // sibling: same MySQL-vs-SQLite dialect trap as seedSystemIfEmpty.
    createdAt: now,
    updatedAt: now,
    role: 'resident',
  });
  
  return {
    id: insertedId(result),
    ...data,
    lastSignedIn: new Date(),
            role: 'resident' as const,  };
}

export async function updateUser(id: number, data: Partial<{
  name: string;
  picture: string;
  lastSignedIn: Date;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

export async function deleteWorkOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(workOrders).where(eq(workOrders.id, id));
}

// ─── IoT Devices ──────────────────────────────────────────────────────────────

export async function getDevicesByUnit(unitId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(devices).where(eq(devices.unitId, unitId));
  } catch (error) {
    if (!isMissingDevicesTable(error)) throw error;
    await ensureDevicesTable();
    return [];
  }
}

export async function getDevicesByAmenity(amenityId?: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    if (amenityId) {
      return await db.select().from(devices).where(eq(devices.amenityId, amenityId));
    }
    return await db.select().from(devices).where(sql`${devices.amenityId} IS NOT NULL`);
  } catch (error) {
    if (!isMissingDevicesTable(error)) throw error;
    await ensureDevicesTable();
    return [];
  }
}

export async function getDeviceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    return result[0];
  } catch (error) {
    if (!isMissingDevicesTable(error)) throw error;
    await ensureDevicesTable();
    return undefined;
  }
}

export async function updateDeviceStatus(deviceId: number, status: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(devices).set({ status, lastSeen: new Date() }).where(eq(devices.id, deviceId));
  } catch (error) {
    if (!isMissingDevicesTable(error)) throw error;
    await ensureDevicesTable();
  }
}

// ─── Financial System ────────────────────────────────────────────────────────

export async function getUserWallet(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    if (result.length > 0) return result[0];
  } catch (error) {
    if (!isMissingWalletsTable(error)) throw error;
    await ensureWalletsTable();
  }

  const newWallet = { userId, balance: 0, points: 1000, updatedAt: new Date() };
  await db.insert(wallets).values(newWallet);
  const created = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return created[0];
}

export async function getUserTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    await ensureWalletsTable();
    await ensureTransactionsTable();
  } catch {
    // Table self-heal is best-effort for local SQLite dev only.
  }
  const wallet = await getUserWallet(userId);
  if (!wallet) return [];
  try {
    return await db.select().from(transactions).where(eq(transactions.walletId, wallet.id)).orderBy(desc(transactions.createdAt));
  } catch (error) {
    if (!isMissingTransactionsTable(error)) throw error;
    await ensureTransactionsTable();
    return [];
  }
}

// ─── Access Control ──────────────────────────────────────────────────────────

export async function createAccessLog(data: Partial<AccessLogInsert>) {
  const db = await getDb();
  if (!db) return;
  // createdAt is defaultNow() in the (mysql) schema → emits now(), which SQLite
  // lacks. Supply an explicit Date so the insert never hits the server-side
  // default (same dialect trap as createUser / seedSystemIfEmpty).
  const values = { ...data, createdAt: data.createdAt ?? new Date() };
  try {
    await db.insert(accessLogs).values(values);
  } catch (error) {
    if (!isMissingAccessLogsTable(error)) throw error;
    await ensureAccessLogsTable();
    await db.insert(accessLogs).values(values);
  }
}

export async function getLatestAccessLogs(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(accessLogs).orderBy(desc(accessLogs.createdAt)).limit(limit);
  } catch (error) {
    if (!isMissingAccessLogsTable(error)) throw error;
    await ensureAccessLogsTable();
    return [];
  }
}

// ─── AI Dispatching (Jobs) ───────────────────────────────────────────────────

export async function createSystemJob(data: SystemJobInsert) {
  const db = await getDb();
  if (!db) return 0;
  // createdAt is defaultNow() → now() on SQLite. Set it once so BOTH the primary
  // insert and the post-self-heal retry avoid the server-side default. (Before,
  // only the retry set it — but the primary's now() error isn't a missing-table
  // error, so it rethrew and any resident *with* a unit hit `no such function: now`.)
  const values = { ...data, createdAt: data.createdAt ?? new Date() };
  try {
    const result = await db.insert(systemJobs).values(values);
    return insertedId(result);
  } catch (error) {
    if (!isMissingSystemJobsTable(error)) throw error;
    await ensureSystemJobsTable();
    const result = await db.insert(systemJobs).values(values);
    return insertedId(result);
  }
}

export async function updateJobProgress(id: number, progress: number, currentStep: string) {
  const db = await getDb();
  if (!db) return;
  const status = progress >= 100 ? "completed" : "running";
  try {
    await db.update(systemJobs).set({ progress, currentStep, status }).where(eq(systemJobs.id, id));
  } catch (error) {
    if (!isMissingSystemJobsTable(error)) throw error;
    await ensureSystemJobsTable();
  }
}

export async function getActiveJobsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(systemJobs).where(and(eq(systemJobs.userId, userId), eq(systemJobs.status, "running")));
  } catch (error) {
    if (!isMissingSystemJobsTable(error)) throw error;
    await ensureSystemJobsTable();
    return [];
  }
}

// ─── System Seeding ─────────────────────────────────────────────────────────

export async function seedSystemIfEmpty() {
  const db = await getDb();
  if (!db) return;
  const now = new Date();

  let existingUnits: typeof units.$inferSelect[] = [];
  try {
    existingUnits = await db.select().from(units).limit(1);
  } catch (error) {
    if (!isMissingUnitsTable(error)) throw error;
    await ensureUnitsTable();
  }
  if (existingUnits.length === 0) {
    await db.insert(units).values([
      { unitNumber: "42A", floor: 42, wing: "East", squareFootage: 2500, createdAt: now },
      { unitNumber: "42B", floor: 42, wing: "West", squareFootage: 2200, createdAt: now },
    ]);
  }

  const existingAmenities = await db.select().from(amenities).limit(1);
  if (existingAmenities.length === 0) {
    await db.insert(amenities).values([
      {
        name: "Private Dining Room",
        icon: "fork.knife",
        category: "dining",
        capacity: 12,
        openTime: "11:00",
        closeTime: "23:00",
        minTier: "Black",
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Sky Infinity Pool",
        icon: "waves",
        category: "recreation",
        capacity: 25,
        openTime: "06:00",
        closeTime: "22:00",
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  const allUnits = await db.select().from(units).limit(1);
  const allAmenities = await db.select().from(amenities).limit(2);

  if (allUnits.length > 0) {
    const unitId = allUnits[0].id;
    const existingDevices = await db.select().from(devices).where(eq(devices.unitId, unitId)).limit(1);
    if (existingDevices.length === 0) {
      await db.insert(devices).values([
        { unitId, name: "Living Room AC", type: "climate", status: "22°C", lastSeen: now },
        { unitId, name: "Main Gallery Lights", type: "light", status: "on", lastSeen: now },
      ]);
    }
  }

  if (allAmenities.length > 0) {
    const existingAmenityDevices = await db.select().from(devices).where(sql`${devices.amenityId} IS NOT NULL`).limit(1);
    if (existingAmenityDevices.length === 0) {
      console.log("[Seeder] Initializing IoT devices for Amenities...");
      await db.insert(devices).values([
        { amenityId: allAmenities[0].id, name: "Chef's Kitchen Range", type: "power", status: "off", lastSeen: now },
        { amenityId: allAmenities[1].id, name: "Pool Filtration System", type: "power", status: "active", lastSeen: now },
        { amenityId: allAmenities[1].id, name: "Rooftop Floodlights", type: "light", status: "off", lastSeen: now },
      ]);
    }
  }

  // 4. Seed Access Logs (For Live Feed Demo)
  let existingLogs: typeof accessLogs.$inferSelect[] = [];
  try {
    existingLogs = await db.select().from(accessLogs).limit(1);
  } catch (error) {
    if (!isMissingAccessLogsTable(error)) throw error;
    await ensureAccessLogsTable();
  }
  if (existingLogs.length === 0) {
    console.log("[Seeder] Initializing access logs...");
    await db.insert(accessLogs).values([
      { entryPoint: "Main Lobby", result: "success", createdAt: new Date(Date.now() - 1000 * 60 * 5) }, // 5 mins ago
      { entryPoint: "Elevator B1", result: "success", createdAt: new Date(Date.now() - 1000 * 60 * 15) },
      { entryPoint: "Rooftop Access", result: "denied", createdAt: new Date(Date.now() - 1000 * 60 * 45) },
      { entryPoint: "Gym Turnstile", result: "success", createdAt: new Date(Date.now() - 1000 * 60 * 60) },
      { entryPoint: "Service Entrance", result: "expired", createdAt: new Date(Date.now() - 1000 * 60 * 120) },
    ]);
  }
}
