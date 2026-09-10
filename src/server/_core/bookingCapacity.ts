/**
 * Shared amenity booking capacity logic — used by BOTH bookingsRouter.create and
 * the voice commit path (routers/voice.ts), so the two can't diverge.
 *
 * Audit finding C: the original occupancy count matched only bookings with the
 * EXACT same startTime string, so an overlapping booking with a different start
 * (e.g. an 11:00-23:00 reservation vs a 12:00-13:00 request) wasn't counted and
 * the room could be overbooked. Occupancy is now computed by time-range overlap.
 */
export type BookingWindow = { startTime: string; endTime: string; guestCount: number };

/** minutes since midnight for "HH:MM" (NaN-safe: unparseable → NaN, filtered by callers). */
function toMinutes(hhmm: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(hhmm))) return NaN;
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Two [start,end) windows overlap when start < otherEnd AND end > otherStart.
 *  Touching edges (end == start) do NOT overlap. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Peak concurrent guests inside the requested half-open window. */
export function occupancyForWindow(existing: BookingWindow[], startTime: string, endTime: string): number {
  const s=toMinutes(startTime),e=toMinutes(endTime);
  const events=new Map<number,number>();
  for(const booking of existing) {
    const start=toMinutes(booking.startTime),end=toMinutes(booking.endTime);
    if(!overlaps(s,e,start,end))continue;
    const left=Math.max(s,start),right=Math.min(e,end);
    events.set(left,(events.get(left)??0)+booking.guestCount);
    events.set(right,(events.get(right)??0)-booking.guestCount);
  }
  let current=0,peak=0;
  for(const [,delta] of [...events].sort(([a],[b])=>a-b)) {current+=delta;peak=Math.max(peak,current);}
  return peak;
}

/** Throw if the requested window is invalid or would exceed capacity for an
 *  overlapping slot. Message contains "capacity" / "time" for caller mapping. */
export function assertWithinCapacity(input: {
  existing: BookingWindow[];
  startTime: string;
  endTime: string;
  guestCount: number;
  capacity: number;
}): void {
  const s = toMinutes(input.startTime);
  const e = toMinutes(input.endTime);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
    throw new Error(`Invalid booking time window ${input.startTime}–${input.endTime}: end must be after start.`);
  }
  const occupancy = occupancyForWindow(input.existing, input.startTime, input.endTime);
  if (occupancy + input.guestCount > input.capacity) {
    const left = input.capacity - occupancy;
    throw new Error(`Capacity exceeded. Only ${left} spot(s) left for this slot.`);
  }
}
