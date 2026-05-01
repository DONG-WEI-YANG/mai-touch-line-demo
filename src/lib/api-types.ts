/**
 * API adapter types — bridges the gap between DB/server shapes and frontend shapes.
 *
 * The server returns DB-native types (numeric IDs, different field names).
 * The frontend uses richer client-side shapes (string IDs, denormalized names).
 * This file defines the API-level shapes & conversion helpers.
 */

import type { Booking as ClientBooking, WorkOrder as ClientWorkOrder, BookingStatus } from "./types";

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

/**
 * Convert API bookings array safely (with null guard).
 */
export function toClientBookings(items: unknown): ClientBooking[] {
  if (!Array.isArray(items)) return [];
  return items.map((b) => toClientBooking(b as ApiBookingWithAmenity));
}

/**
 * Convert API work orders array safely (with null guard).
 */
export function toClientWorkOrders(items: unknown): ClientWorkOrder[] {
  if (!Array.isArray(items)) return [];
  return items.map((wo) => toClientWorkOrder(wo as ApiWorkOrder));
}
