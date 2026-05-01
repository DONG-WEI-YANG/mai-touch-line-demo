import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { integer, text as sqliteText, sqliteTable, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Units — Physical apartment units in the building.
 */
export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  unitNumber: varchar("unitNumber", { length: 32 }).notNull().unique(), // e.g. "42A"
  floor: int("floor").notNull(),
  wing: varchar("wing", { length: 32 }), // e.g. "East", "West"
  squareFootage: int("squareFootage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  picture: text("picture"),
  role: mysqlEnum("role", ["resident", "admin", "logistics"]).default("resident").notNull(),
  unitId: int("unitId"), // Link to units table
  tier: mysqlEnum("tier", ["Platinum", "Diamond", "Black"]).default("Platinum").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Amenities — bookable facilities in the property.
 */
export const amenities = mysqlTable("amenities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 64 }).default("star").notNull(),
  category: mysqlEnum("category", ["recreation", "wellness", "entertainment", "business", "dining", "outdoor"]).default("recreation").notNull(),
  capacity: int("capacity").default(10).notNull(),
  minTier: mysqlEnum("minTier", ["Platinum", "Diamond", "Black"]).default("Platinum").notNull(),
  location: varchar("location", { length: 255 }),
  rules: text("rules"),
  isActive: boolean("isActive").default(true).notNull(),
  maintenanceNote: text("maintenanceNote"),
  openTime: varchar("openTime", { length: 5 }).default("08:00").notNull(),
  closeTime: varchar("closeTime", { length: 5 }).default("22:00").notNull(),
  slotDurationMinutes: int("slotDurationMinutes").default(60).notNull(),
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Amenity = typeof amenities.$inferSelect;
export type InsertAmenity = typeof amenities.$inferInsert;

/**
 * Bookings — reservations for amenities by residents.
 */
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amenityId: int("amenityId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar("startTime", { length: 5 }).notNull(), // HH:MM
  endTime: varchar("endTime", { length: 5 }).notNull(), // HH:MM
  guestCount: int("guestCount").default(1).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["confirmed", "pending", "cancelled", "completed"]).default("confirmed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

/**
 * Work Orders — maintenance, security, and concierge requests.
 */
export const workOrders = mysqlTable("work_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["maintenance", "security", "concierge", "housekeeping", "other"]).default("maintenance").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  assignedTo: varchar("assignedTo", { length: 255 }),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = typeof workOrders.$inferInsert;

/**
 * Chat Messages — conversation history between residents and AI.
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  language: varchar("language", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
/**
 * OAuth Sessions — active user sessions for OAuth authentication.
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Devices — IoT hardware in the units or amenities.
 */
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  unitId: int("unitId"), // Nullable for public amenity devices
  amenityId: int("amenityId"), // Link to public amenities
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["light", "climate", "curtain", "security", "media", "power"]).notNull(),
  status: varchar("status", { length: 64 }).default("off").notNull(),
  lastSeen: timestamp("lastSeen").defaultNow().notNull(),
});

/**
 * Batch Control Audit Logs — persistent audit trail for bulk amenity device control.
 */
export const batchControlAuditLogs = mysqlTable("batch_control_audit_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  timestamp: varchar("timestamp", { length: 40 }).notNull(),
  adminOpenId: varchar("adminOpenId", { length: 64 }),
  amenityId: int("amenityId").notNull(),
  deviceType: mysqlEnum("deviceType", ["light", "climate", "curtain", "security", "media", "power"]).notNull(),
  status: varchar("status", { length: 64 }).notNull(),
  targetDeviceCount: int("targetDeviceCount").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]).notNull(),
  riskReasons: text("riskReasons").notNull(),
  requiredPermissionTier: mysqlEnum("requiredPermissionTier", ["L1", "L2", "L3"]).notNull(),
  grantedPermissionTier: mysqlEnum("grantedPermissionTier", ["L1", "L2", "L3"]).notNull(),
  effectivePermissionTier: mysqlEnum("effectivePermissionTier", ["L1", "L2", "L3"]).notNull(),
  pinRequired: boolean("pinRequired").default(false).notNull(),
  pinVerification: mysqlEnum("pinVerification", ["not_required", "passed", "missing", "failed"]).notNull(),
  result: mysqlEnum("result", ["success", "rejected", "failed"]).notNull(),
  dispatchedCount: int("dispatchedCount").default(0).notNull(),
  fallbackCount: int("fallbackCount").default(0).notNull(),
  errorCode: varchar("errorCode", { length: 64 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BatchControlAuditLogRow = typeof batchControlAuditLogs.$inferSelect;
export type InsertBatchControlAuditLogRow = typeof batchControlAuditLogs.$inferInsert;

/**
 * Access Passes — Physical entry credentials for guests.
 */
export const accessPasses = mysqlTable("access_passes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  guestName: varchar("guestName", { length: 255 }).notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(), // Encrypted hash
  type: mysqlEnum("type", ["one_time", "temporary", "permanent"]).default("one_time").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  status: mysqlEnum("status", ["active", "used", "expired", "revoked"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Wallets — User financial balance and points.
 */
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: int("balance").default(0).notNull(), // Stored in cents
  points: int("points").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

/**
 * Transactions — Financial history record.
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  type: mysqlEnum("type", ["payment", "refund", "fee", "topup"]).notNull(),
  amount: int("amount").notNull(), // Positive or negative
  currency: varchar("currency", { length: 3 }).default("TWD").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "success", "failed"]).default("success").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Access Logs — Records of physical entries and security events.
 */
export const accessLogs = mysqlTable("access_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // Link to resident if applicable
  passId: int("passId"), // Link to guest pass if applicable
  entryPoint: varchar("entryPoint", { length: 255 }).notNull(), // e.g. "Main Lobby", "Unit 42A Door"
  result: mysqlEnum("result", ["success", "denied", "expired"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * System Jobs — Multi-step physical tasks orchestrated by AI.
 */
export const systemJobs = mysqlTable("system_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(), // e.g. "arrival", "departure", "hosting"
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  progress: int("progress").default(0).notNull(), // 0-100
  currentStep: text("currentStep"), // Current action description
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemJob = typeof systemJobs.$inferSelect;
export type InsertSystemJob = typeof systemJobs.$inferInsert;

/**
 * LINE User — Maps a LINE user identity to an optional app user account.
 */
export const lineUser = sqliteTable('line_user', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  channelId:   sqliteText('channel_id').notNull(),
  lineUserId:  sqliteText('line_user_id').notNull(),
  appUserId:   integer('app_user_id'),
  role:        sqliteText('role', { enum: ['resident', 'housekeeper', 'admin'] }).notNull().default('resident'),
  displayName: sqliteText('display_name'),
  pictureUrl:  sqliteText('picture_url'),
  language:    sqliteText('language', { enum: ['zh-TW', 'en', 'ja'] }).default('zh-TW'),
  isDemo:      integer('is_demo').notNull().default(0),
  createdAt:   sqliteText('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt:   sqliteText('updated_at').default('CURRENT_TIMESTAMP'),
}, (t) => ({
  uniq:    uniqueIndex('uniq_line_user_channel_user').on(t.channelId, t.lineUserId),
  roleIdx: index('idx_line_user_role').on(t.role),
}));

export type LineUser = typeof lineUser.$inferSelect;
export type InsertLineUser = typeof lineUser.$inferInsert;

/**
 * LINE Message Log — Records inbound and outbound LINE messages.
 */
export const lineMessageLog = sqliteTable('line_message_log', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  lineUserId:  sqliteText('line_user_id').notNull(),
  direction:   sqliteText('direction', { enum: ['inbound', 'outbound', 'outbound:debug'] }).notNull(),
  messageType: sqliteText('message_type').notNull(),
  content:     sqliteText('content'),
  intent:      sqliteText('intent'),
  sessionId:   sqliteText('session_id'),
  createdAt:   sqliteText('created_at').default('CURRENT_TIMESTAMP'),
}, (t) => ({
  userTimeIdx: index('idx_line_message_log_user_time').on(t.lineUserId, t.createdAt),
}));

export type LineMessageLog = typeof lineMessageLog.$inferSelect;
export type InsertLineMessageLog = typeof lineMessageLog.$inferInsert;


























