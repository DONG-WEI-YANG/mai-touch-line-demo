/**
 * Voice command core — shared brain for the "口說預約公設 / 派單" feature.
 *
 * Two pure(-ish) functions, both dependency-injected so the four planned front
 * ends (resident phone, property-desk tablet, and later public kiosk) share one
 * implementation, and so tests can feed a transcript string + a mock classifier
 * and skip STT / the live NLP service entirely:
 *
 *   buildVoiceProposal  — transcript → { intent, kind, slots, missing, ... }
 *                         NEVER writes anything. "Listen and propose."
 *   commitVoiceProposal — a user-confirmed { intent, slots } → book / dispatch.
 *
 * Design rationale lives in docs/superpowers/specs/2026-07-12-voice-booking-design.md.
 */
import type { IntentClassifier, IntentName, IntentResult, Slot, Lang } from "../line/ai/types";

/** Confidence at/above which we trust the classifier. Mirrors the LINE resident
 *  handler's 0.6 gate (src/server/line/handlers/resident.ts). */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/** Required slots per actionable intent. Kept in sync with REQUIRED_SLOTS in
 *  src/server/line/handlers/resident.ts — the same slot contract, reused here so
 *  voice and LINE agree on what "complete" means. */
export const REQUIRED_SLOTS: Partial<Record<IntentName, string[]>> = {
  "facility.book": ["facility", "date", "time"],
  "repair.report": ["issue", "location", "urgency"],
  "visitor.notify": ["visitor_name", "visitor_count", "date", "time"],
  "complaint.file": ["issue"],
};

/** Intents that only read — must never fall through to a create. */
const QUERY_INTENTS = new Set<IntentName>(["facility.list", "facility.cancel", "workorder.status"]);
/** Intents that produce a work order (everything actionable that isn't a booking). */
const WORK_ORDER_INTENTS = new Set<IntentName>(["repair.report", "visitor.notify", "complaint.file"]);

/** Thrown when a commit fails due to bad client input (missing/invalid slots,
 *  unknown facility, non-committable intent). The router maps this to a 400
 *  BAD_REQUEST; unmapped errors would surface as a 500. Capacity conflicts are
 *  raised by the injected assertBookingAllowed as its own (409) error. */
export class VoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceValidationError";
  }
}

export type VoiceProposalKind = "booking" | "work_order" | "query" | "unclear";

export type VoiceProposal = {
  transcript: string;
  intent: IntentName;
  kind: VoiceProposalKind;
  slots: Slot;
  missing: string[];
  confidence: number;
  language: Lang;
};

export type BuildVoiceProposalInput = {
  transcript: string;
  classifier: IntentClassifier;
  userId: string;
  history?: string[];
  confidenceThreshold?: number;
};

export async function buildVoiceProposal(input: BuildVoiceProposalInput): Promise<VoiceProposal> {
  const { transcript, classifier, userId, history, confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD } = input;
  const trimmed = transcript.trim();

  // Empty transcript (STT returned nothing) — don't burn an NLP call.
  if (trimmed.length === 0) {
    return { transcript, intent: "unknown", kind: "unclear", slots: {}, missing: [], confidence: 0, language: "zh-TW" };
  }

  const r: IntentResult = await classifier.classify(trimmed, { userId, history });
  const kind = classifyKind(r, confidenceThreshold);
  const missing = kind === "booking" || kind === "work_order" ? missingSlots(r.intent, r.slots) : [];

  return {
    transcript: trimmed,
    intent: r.intent,
    kind,
    slots: r.slots ?? {},
    missing,
    confidence: r.confidence,
    language: r.language ?? "zh-TW",
  };
}

function classifyKind(r: IntentResult, threshold: number): VoiceProposalKind {
  if (r.intent === "unknown" || r.intent === "small_talk" || r.confidence < threshold) return "unclear";
  if (r.intent === "facility.book") return "booking";
  if (QUERY_INTENTS.has(r.intent)) return "query";
  if (WORK_ORDER_INTENTS.has(r.intent)) return "work_order";
  return "unclear";
}

function missingSlots(intent: IntentName, slots: Slot | undefined): string[] {
  const required = REQUIRED_SLOTS[intent] ?? [];
  const present = slots ?? {};
  return required.filter((k) => (present as Record<string, unknown>)[k] == null || (present as Record<string, unknown>)[k] === "");
}

// ── commit ────────────────────────────────────────────────────────────────────

export type CommitDeps = {
  /** facility slot value ('gym'|'pool'|…) → amenity row id. */
  resolveAmenityId: (facility: string) => number | undefined;
  createBooking: (input: {
    userId: number;
    amenityId: number;
    date: string;
    startTime: string;
    endTime: string;
    guestCount: number;
    notes?: string;
  }) => Promise<number>;
  createWorkOrder: (input: {
    userId: number;
    title: string;
    description?: string;
    category: WoCategory;
    priority: WoPriority;
  }) => Promise<number>;
  /** Capacity/slot guard — must throw if the booking would exceed the amenity's
   *  capacity for that slot. Mirrors the check in bookingsRouter.create so the
   *  voice path can't silently overbook (audit finding C1). */
  assertBookingAllowed: (input: {
    amenityId: number;
    date: string;
    startTime: string;
    endTime: string;
    guestCount: number;
  }) => Promise<void>;
};

export type CommitVoiceProposalInput = {
  intent: IntentName;
  slots: Slot;
  userId: number;
  deps: CommitDeps;
};

export async function commitVoiceProposal(input: CommitVoiceProposalInput): Promise<{ ref: string }> {
  const { intent, slots, userId, deps } = input;

  if (intent === "facility.book") return commitBooking(slots, userId, deps);
  if (WORK_ORDER_INTENTS.has(intent)) return commitWorkOrder(intent, slots, userId, deps);

  throw new VoiceValidationError(`Intent "${intent}" is not committable (query or unclear intents never write).`);
}

async function commitBooking(slots: Slot, userId: number, deps: CommitDeps): Promise<{ ref: string }> {
  const missing = missingSlots("facility.book", slots);
  if (missing.length > 0) {
    throw new VoiceValidationError(`Cannot book: missing required slot(s) ${missing.join(", ")}.`);
  }
  const facility = String(slots.facility);
  const amenityId = deps.resolveAmenityId(facility);
  if (amenityId == null) {
    throw new VoiceValidationError(`Unknown facility "${facility}" — no matching amenity.`);
  }
  // Validate the free-form NLP date/time BEFORE anything hits the DB (audit
  // finding C2). NLP can return "下週一" / "下午三點"; writing those produces
  // garbage rows and NaN time math.
  const date = String(slots.date);
  const startTime = String(slots.time);
  if (!isValidDate(date)) {
    throw new VoiceValidationError(`Invalid booking date "${date}" — expected YYYY-MM-DD.`);
  }
  if (!isValidTime(startTime)) {
    throw new VoiceValidationError(`Invalid booking time "${startTime}" — expected HH:MM.`);
  }
  const endTime = deriveEndTime(startTime, slots.duration_min);

  // Capacity guard — reject an overbooked slot before writing (audit finding C1).
  await deps.assertBookingAllowed({ amenityId, date, startTime, endTime, guestCount: 1 });

  const id = await deps.createBooking({
    userId,
    amenityId,
    date,
    startTime,
    endTime,
    guestCount: 1,
    notes: `[voice] facility=${facility}`,
  });
  return { ref: `BK-${id}` };
}

/** YYYY-MM-DD and a real calendar date. */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}

/** 24-hour HH:MM. */
export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

async function commitWorkOrder(intent: IntentName, slots: Slot, userId: number, deps: CommitDeps): Promise<{ ref: string }> {
  const intentShort = intent.split(".")[0];
  const summaryParts = [
    slots.issue,
    slots.location,
    slots.visitor_name && `visitor=${slots.visitor_name}`,
    slots.visitor_count && `count=${slots.visitor_count}`,
    slots.date,
    slots.time,
  ].filter(Boolean);
  const blob = `${intent} ${summaryParts.join(" ")} ${JSON.stringify(slots)}`;
  const id = await deps.createWorkOrder({
    userId,
    title: `[${intentShort}] ${summaryParts[0] ?? "語音工單"}`,
    description: JSON.stringify(slots),
    category: inferCategory(intentShort, blob),
    priority: urgencyToPriority(slots.urgency),
  });
  const prefix = intentShort === "repair" ? "WO" : intentShort === "visitor" ? "V" : "C";
  return { ref: `${prefix}-${id}` };
}

// ── shared helpers (mirror src/server/index.ts bookFn/reportFn) ─────────────────

export type WoCategory = "maintenance" | "security" | "concierge" | "housekeeping" | "laundry" | "vehicle" | "other";
export type WoPriority = "low" | "medium" | "high" | "urgent";

/** end = start + durationMin (default 60), wrapping past midnight. Throws on an
 *  unparseable time or a non-positive duration rather than emitting "NaN:NaN"
 *  (audit finding C2). */
export function deriveEndTime(startTime: string, durationMin = 60): string {
  const [h, m] = startTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error(`Cannot derive end time from "${startTime}" — expected HH:MM.`);
  }
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    throw new Error(`Invalid duration ${durationMin} — must be a positive number of minutes.`);
  }
  const total = (h * 60 + (m || 0) + durationMin) % (24 * 60);
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function urgencyToPriority(urgency: string | undefined): WoPriority {
  if (urgency === "high") return "high";
  if (urgency === "low") return "low";
  return "medium";
}

/** Build facility-key → amenityId map from the amenities table, matching the
 *  same keys the NLP `facility` slot emits. Mirrors the boot-time map in
 *  src/server/index.ts so voice bookings target the same amenities as LINE. */
export function buildFacilityMap(amenities: Array<{ id: number; name?: string | null }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of amenities) {
    const n = (a.name ?? "").toLowerCase();
    for (const k of ["gym", "pool", "meeting_room", "meeting", "lounge", "bbq", "sauna"]) {
      if (n.includes(k)) map.set(k, a.id);
    }
  }
  if (map.has("meeting") && !map.has("meeting_room")) {
    map.set("meeting_room", map.get("meeting")!);
  }
  return map;
}

/** Keyword-first category inference — mirrors inferCategory() in src/server/index.ts
 *  so voice-filed and LINE-filed work orders land in the same buckets. */
export function inferCategory(intentShort: string, blob: string): WoCategory {
  const t = blob.toLowerCase();
  if (/送洗|乾洗|洗衣|laundry/.test(t)) return "laundry";
  if (/打掃|清潔|housekeeping|cleaning/.test(t)) return "housekeeping";
  if (/接送|機場|車輛|代駕|外出|airport|pickup|drop[- ]?off/.test(t)) return "vehicle";
  if (intentShort === "repair") return "maintenance";
  if (intentShort === "visitor") return "concierge";
  if (intentShort === "complaint") return "other";
  return "other";
}
