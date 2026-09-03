import type { OfflineOperation, OfflineOperationType } from "./offline";

export type OfflineQuarantineReason =
  | "invalid_json"
  | "invalid_root"
  | "invalid_operation"
  | "invalid_payload"
  | "duplicate_id";

export interface OfflineQuarantineFinding {
  index: number;
  id?: string;
  reason: OfflineQuarantineReason;
}

export interface ParsedOfflineQueue {
  operations: OfflineOperation[];
  quarantined: OfflineQuarantineFinding[];
}

const OPERATION_TYPES = new Set<OfflineOperationType>([
  "create_booking",
  "update_booking",
  "cancel_booking",
  "create_work_order",
  "update_work_order",
  "send_message",
]);
const OPERATION_STATUSES = new Set(["pending", "processing", "completed", "failed"]);
const BOOKING_STATUSES = new Set(["confirmed", "pending", "cancelled", "completed"]);
const WORK_ORDER_STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);
const WORK_ORDER_CATEGORIES = new Set(["maintenance", "security", "concierge", "housekeeping", "other"]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidPayload(type: OfflineOperationType, data: Record<string, unknown>): boolean {
  switch (type) {
    case "cancel_booking":
      return isPositiveInteger(data.id);
    case "create_booking":
      return isPositiveInteger(data.amenityId)
        && isNonBlankString(data.date)
        && isNonBlankString(data.startTime)
        && isNonBlankString(data.endTime)
        && isPositiveInteger(data.guestCount)
        && (data.notes === undefined || typeof data.notes === "string");
    case "update_booking":
      return isPositiveInteger(data.id)
        && typeof data.status === "string"
        && BOOKING_STATUSES.has(data.status);
    case "create_work_order":
      return isNonBlankString(data.title)
        && (data.description === undefined || typeof data.description === "string")
        && typeof data.category === "string"
        && WORK_ORDER_CATEGORIES.has(data.category)
        && typeof data.priority === "string"
        && PRIORITIES.has(data.priority);
    case "update_work_order":
      return isPositiveInteger(data.id)
        && (data.status === undefined || (typeof data.status === "string" && WORK_ORDER_STATUSES.has(data.status)))
        && (data.assignedTo === undefined || typeof data.assignedTo === "string")
        && (data.priority === undefined || (typeof data.priority === "string" && PRIORITIES.has(data.priority)));
    case "send_message":
      return isNonBlankString(data.message)
        && (data.language === undefined || data.language === "en" || data.language === "zh");
  }
}

function finding(index: number, item: unknown, reason: OfflineQuarantineReason): OfflineQuarantineFinding {
  const id = isRecord(item) && typeof item.id === "string" ? item.id : undefined;
  return id ? { index, id, reason } : { index, reason };
}

export function parseOfflineQueue(serialized: string | null): ParsedOfflineQueue {
  if (!serialized) return { operations: [], quarantined: [] };

  let payload: unknown;
  try {
    payload = JSON.parse(serialized);
  } catch {
    return {
      operations: [],
      quarantined: [{ index: -1, reason: "invalid_json" }],
    };
  }
  if (!Array.isArray(payload)) {
    return {
      operations: [],
      quarantined: [{ index: -1, reason: "invalid_root" }],
    };
  }

  const operations: OfflineOperation[] = [];
  const quarantined: OfflineQuarantineFinding[] = [];
  const ids = new Set<string>();

  payload.forEach((item, index) => {
    if (!isRecord(item)
      || !isNonBlankString(item.id)
      || typeof item.type !== "string"
      || !OPERATION_TYPES.has(item.type as OfflineOperationType)
      || typeof item.timestamp !== "number"
      || !Number.isFinite(item.timestamp)
      || item.timestamp <= 0
      || !Number.isInteger(item.retryCount)
      || Number(item.retryCount) < 0
      || typeof item.status !== "string"
      || !OPERATION_STATUSES.has(item.status)) {
      quarantined.push(finding(index, item, "invalid_operation"));
      return;
    }
    if (ids.has(item.id)) {
      quarantined.push(finding(index, item, "duplicate_id"));
      return;
    }
    if (!isRecord(item.data) || !hasValidPayload(item.type as OfflineOperationType, item.data)) {
      quarantined.push(finding(index, item, "invalid_payload"));
      return;
    }

    ids.add(item.id);
    operations.push(item as OfflineOperation);
  });

  return { operations, quarantined };
}
