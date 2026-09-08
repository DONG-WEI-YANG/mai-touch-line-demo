import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { assertWithinCapacity } from "../_core/bookingCapacity";
import { runExclusive } from "../_core/keyedLock";

type BookingInput = {
  userId: number; amenityId: number; date: string;
  startTime: string; endTime: string; guestCount: number; notes?: string;
};

/** Shared by API and voice writers. Lock is process-local, not distributed. */
export function createCheckedBooking(input: BookingInput) {
  return runExclusive(`booking:${input.amenityId}:${input.date}`, async () => {
    const amenity = await db.getAmenityById(input.amenityId);
    if (!amenity) throw new TRPCError({ code: "NOT_FOUND", message: "Amenity not found" });
    if (amenity.isActive === false || Number(amenity.isActive) === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Amenity is not available for booking" });
    }
    const existing = await db.getBookingsByAmenityAndDate(input.amenityId, input.date);
    try {
      assertWithinCapacity({ ...input, existing, capacity: amenity.capacity });
    } catch (error) {
      throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "Capacity exceeded" });
    }
    return db.createBooking(input);
  });
}

/** Re-confirmation must use the same capacity lock as new bookings. */
export async function updateCheckedBookingStatus(id: number, status: "confirmed" | "pending" | "cancelled" | "completed", residentUserId?: number) {
  const initial = await db.getBookingById(id);
  if (!initial) throw new TRPCError({ code: "NOT_FOUND", message: "找不到預約" });
  return runExclusive(`booking:${initial.amenityId}:${initial.date}`, async () => {
    const before = await db.getBookingById(id);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "找不到預約" });
    if (residentUserId !== undefined) {
      if (before.userId !== residentUserId) throw new TRPCError({ code: "FORBIDDEN", message: "只能取消自己的預約" });
      if (status !== "cancelled" || before.status === "completed") {
        throw new TRPCError({ code: "CONFLICT", message: "已完成的預約無法取消，請聯絡物業" });
      }
      if (before.status === "cancelled") return before;
    }
    if (status === "confirmed" && before.status !== "confirmed") {
      const amenity = await db.getAmenityById(before.amenityId);
      if (!amenity) throw new TRPCError({ code: "NOT_FOUND", message: "找不到設施" });
      if (amenity.isActive === false || Number(amenity.isActive) === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "設施已停用，無法確認預約" });
      }
      const existing = await db.getBookingsByAmenityAndDate(before.amenityId, before.date);
      try {
        assertWithinCapacity({ ...before, existing: existing.filter((booking) => booking.id !== id), capacity: amenity.capacity });
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "Capacity exceeded" });
      }
    }
    await db.updateBookingStatus(id, status);
    return before;
  });
}
