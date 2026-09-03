export type MessageRole = "user" | "assistant";
export type ChatDeliveryState = "sending" | "queued" | "confirmed" | "failed";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  delivery?: ChatDeliveryState;
  operationId?: string;
  deliveryError?: string;
  actions?: WorkOrderAction[];
}

export interface WorkOrderAction {
  id: string;
  type: "maintenance" | "security" | "concierge";
  title: string;
  status: "pending" | "in_progress" | "completed";
}

export interface WorkOrder {
  id: string;
  /** Mapped from DB `category` field */
  type: "maintenance" | "security" | "concierge";
  title: string;
  description: string;
  /** Client-mapped status: DB `open` -> `pending`, DB `resolved`/`closed` -> `completed` */
  status: "pending" | "in_progress" | "completed";
  createdAt: number;
  updatedAt: number;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface ResidentProfile {
  name: string;
  unit: string;
  tier: "Platinum" | "Diamond" | "Black";
  avatarUrl?: string;
}

/**
 * BookingStatus visible in the UI.
 * - `confirmed`: booked and verified
 * - `upcoming`:  client-derived (confirmed booking in the future)
 * - `completed`: the session has ended
 * - `cancelled`: booking was cancelled
 *
 * DB does NOT store "upcoming" — it's derived by `toClientBooking()` in api-types.ts.
 */
export type BookingStatus = "confirmed" | "upcoming" | "completed" | "cancelled";

export interface Booking {
  id: string;
  amenityId: string;
  amenityName: string;
  amenityIcon: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: BookingStatus;
  createdAt: number;
  guestCount?: number;
  notes?: string;
}
