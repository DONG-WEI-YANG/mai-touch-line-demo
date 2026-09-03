/**
 * API adapter types — bridges the gap between DB/server shapes and frontend shapes.
 *
 * The server returns DB-native types (numeric IDs, different field names).
 * The frontend uses richer client-side shapes (string IDs, denormalized names).
 * This file defines the API-level shapes & conversion helpers.
 */

import type { Booking as ClientBooking, WorkOrder as ClientWorkOrder, BookingStatus } from "./types";

export type ConversionIssueCode =
  | "INVALID_COLLECTION"
  | "INVALID_BOOKING"
  | "INVALID_WORK_ORDER"
  | "INVALID_DATE"
  | "INVALID_TIMESTAMP"
  | "DUPLICATE_ID";

export interface ConversionIssue {
  index: number;
  code: ConversionIssueCode;
}

export interface ConversionResult<T> {
  items: T[];
  rejectedCount: number;
  issues: ConversionIssue[];
}

// ─── Server-side shapes (what tRPC returns) ──────────────────────────────────

/**
 * What `trpc.bookings.myBookings` returns from the DB.
 */
export interface ApiBooking {
  id: number;
  userId: number;
  amenityId: number;
  date: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  notes: string | null;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * What `trpc.bookings.myBookings` returns when joined with amenity name (optional).
 * The basic query doesn't include amenity name — we handle fallbacks.
 */
export interface ApiBookingWithAmenity extends ApiBooking {
  amenityName?: string | null;
  amenityIcon?: string | null;
}

/**
 * What `trpc.workOrders.myOrders` returns from the DB.
 */
export interface ApiWorkOrder {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  category: "maintenance" | "security" | "concierge" | "housekeeping" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo: string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

/**
 * Map DB booking status → frontend BookingStatus.
 * DB has no "upcoming" — we derive it from date vs today.
 */
function mapBookingStatus(
  status: ApiBooking["status"],
  dateStr: string
): BookingStatus {
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  // "confirmed" or "pending" — check if date is in the future
  const bookingDate = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (bookingDate > today && status === "confirmed") return "upcoming";
  return status === "confirmed" ? "confirmed" : "upcoming";
}

/**
 * Convert API booking (DB shape) → client Booking (frontend shape).
 */
export function toClientBooking(b: ApiBookingWithAmenity): ClientBooking {
  return {
    id: String(b.id),
    amenityId: String(b.amenityId),
    amenityName: b.amenityName ?? `Amenity #${b.amenityId}`,
    amenityIcon: b.amenityIcon ?? "star",
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: mapBookingStatus(b.status, b.date),
    createdAt: b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime(),
    guestCount: b.guestCount,
    notes: b.notes ?? undefined,
  };
}

/**
 * Map DB work order category → frontend WorkOrder type.
 * Frontend "type" matches DB "category" for most values.
 */
function mapWorkOrderType(
  category: ApiWorkOrder["category"]
): ClientWorkOrder["type"] {
  // Frontend type only supports: "maintenance" | "security" | "concierge"
  switch (category) {
    case "maintenance": return "maintenance";
    case "security": return "security";
    case "concierge": return "concierge";
    case "housekeeping": return "concierge"; // map housekeeping→concierge
    case "other": return "maintenance";      // map other→maintenance as fallback
  }
}

/**
 * Map DB work order status → frontend WorkOrder status.
 * Frontend: "pending" | "in_progress" | "completed"
 * DB:       "open" | "in_progress" | "resolved" | "closed"
 */
function mapWorkOrderStatus(
  status: ApiWorkOrder["status"]
): ClientWorkOrder["status"] {
  switch (status) {
    case "open": return "pending";
    case "in_progress": return "in_progress";
    case "resolved": return "completed";
    case "closed": return "completed";
  }
}

/**
 * Convert API work order (DB shape) → client WorkOrder (frontend shape).
 */
export function toClientWorkOrder(wo: ApiWorkOrder): ClientWorkOrder {
  return {
    id: String(wo.id),
    type: mapWorkOrderType(wo.category),
    title: wo.title,
    description: wo.description ?? "",
    status: mapWorkOrderStatus(wo.status),
    createdAt: wo.createdAt instanceof Date ? wo.createdAt.getTime() : new Date(wo.createdAt).getTime(),
    updatedAt: wo.updatedAt instanceof Date ? wo.updatedAt.getTime() : new Date(wo.updatedAt).getTime(),
    priority: wo.priority,
  };
}

const BOOKING_STATUSES = new Set<ApiBooking["status"]>([
  "confirmed",
  "pending",
  "cancelled",
  "completed",
]);
const WORK_ORDER_CATEGORIES = new Set<ApiWorkOrder["category"]>([
  "maintenance",
  "security",
  "concierge",
  "housekeeping",
  "other",
]);
const WORK_ORDER_PRIORITIES = new Set<ApiWorkOrder["priority"]>([
  "low",
  "medium",
  "high",
  "urgent",
]);
const WORK_ORDER_STATUSES = new Set<ApiWorkOrder["status"]>([
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

function isValidTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isValidTimestamp(value: unknown): value is Date | string {
  return (value instanceof Date && Number.isFinite(value.getTime()))
    || (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value)));
}

function hasValidBookingShape(
  value: Record<string, unknown>
): value is Record<string, unknown> & ApiBookingWithAmenity {
  return isPositiveInteger(value.id)
    && isPositiveInteger(value.userId)
    && isPositiveInteger(value.amenityId)
    && typeof value.date === "string"
    && isValidTime(value.startTime)
    && isValidTime(value.endTime)
    && value.startTime < value.endTime
    && typeof value.guestCount === "number"
    && Number.isInteger(value.guestCount)
    && value.guestCount >= 0
    && isNullableString(value.notes)
    && typeof value.status === "string"
    && BOOKING_STATUSES.has(value.status as ApiBooking["status"])
    && isOptionalNullableString(value.amenityName)
    && isOptionalNullableString(value.amenityIcon);
}

function hasValidWorkOrderShape(
  value: Record<string, unknown>
): value is Record<string, unknown> & ApiWorkOrder {
  return isPositiveInteger(value.id)
    && isPositiveInteger(value.userId)
    && typeof value.title === "string"
    && value.title.trim().length > 0
    && isNullableString(value.description)
    && typeof value.category === "string"
    && WORK_ORDER_CATEGORIES.has(value.category as ApiWorkOrder["category"])
    && typeof value.priority === "string"
    && WORK_ORDER_PRIORITIES.has(value.priority as ApiWorkOrder["priority"])
    && typeof value.status === "string"
    && WORK_ORDER_STATUSES.has(value.status as ApiWorkOrder["status"])
    && isNullableString(value.assignedTo);
}

function rejectedCollection<T>(): ConversionResult<T> {
  return {
    items: [],
    rejectedCount: 1,
    issues: [{ index: -1, code: "INVALID_COLLECTION" }],
  };
}

/**
 * Convert and validate booking payloads without allowing a single malformed row
 * to poison the entire client collection. Rejections contain only safe location
 * and reason metadata; raw server values are never copied into diagnostics.
 */
export function toClientBookingsWithDiagnostics(items: unknown): ConversionResult<ClientBooking> {
  if (!Array.isArray(items)) return rejectedCollection();

  const converted: ClientBooking[] = [];
  const issues: ConversionIssue[] = [];
  const seenIds = new Set<number>();

  items.forEach((candidate, index) => {
    if (!isRecord(candidate) || !hasValidBookingShape(candidate)) {
      issues.push({ index, code: "INVALID_BOOKING" });
      return;
    }
    if (!isValidCalendarDate(candidate.date)) {
      issues.push({ index, code: "INVALID_DATE" });
      return;
    }
    if (!isValidTimestamp(candidate.createdAt) || !isValidTimestamp(candidate.updatedAt)) {
      issues.push({ index, code: "INVALID_TIMESTAMP" });
      return;
    }
    if (seenIds.has(candidate.id)) {
      issues.push({ index, code: "DUPLICATE_ID" });
      return;
    }

    seenIds.add(candidate.id);
    converted.push(toClientBooking(candidate));
  });

  converted.sort((left, right) => {
    const dateComparison = left.date.localeCompare(right.date);
    if (dateComparison !== 0) return dateComparison;
    const timeComparison = left.startTime.localeCompare(right.startTime);
    return timeComparison !== 0 ? timeComparison : Number(left.id) - Number(right.id);
  });

  return { items: converted, rejectedCount: issues.length, issues };
}

/** Validate work-order payloads and return newest updates first. */
export function toClientWorkOrdersWithDiagnostics(items: unknown): ConversionResult<ClientWorkOrder> {
  if (!Array.isArray(items)) return rejectedCollection();

  const converted: ClientWorkOrder[] = [];
  const issues: ConversionIssue[] = [];
  const seenIds = new Set<number>();

  items.forEach((candidate, index) => {
    if (!isRecord(candidate) || !hasValidWorkOrderShape(candidate)) {
      issues.push({ index, code: "INVALID_WORK_ORDER" });
      return;
    }
    if (!isValidTimestamp(candidate.createdAt)
      || !isValidTimestamp(candidate.updatedAt)
      || (candidate.resolvedAt !== null && !isValidTimestamp(candidate.resolvedAt))) {
      issues.push({ index, code: "INVALID_TIMESTAMP" });
      return;
    }
    if (seenIds.has(candidate.id)) {
      issues.push({ index, code: "DUPLICATE_ID" });
      return;
    }

    seenIds.add(candidate.id);
    converted.push(toClientWorkOrder(candidate));
  });

  converted.sort((left, right) => right.updatedAt - left.updatedAt || Number(left.id) - Number(right.id));
  return { items: converted, rejectedCount: issues.length, issues };
}

/**
 * Convert API bookings array safely (with null guard).
 */
export function toClientBookings(items: unknown): ClientBooking[] {
  return toClientBookingsWithDiagnostics(items).items;
}

/**
 * Convert API work orders array safely (with null guard).
 */
export function toClientWorkOrders(items: unknown): ClientWorkOrder[] {
  return toClientWorkOrdersWithDiagnostics(items).items;
}
