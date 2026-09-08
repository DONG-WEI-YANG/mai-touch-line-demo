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
