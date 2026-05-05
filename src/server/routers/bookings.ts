import { residentProcedure, adminProcedure, staffProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const bookingsRouter = router({
  myBookings: residentProcedure.query(async ({ ctx }) => db.getUserBookings(ctx.user.id)),

  create: residentProcedure
    .input(z.object({
      amenityId: z.number(),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      guestCount: z.number().min(1).default(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const amenity = await db.getAmenityById(input.amenityId);
      if (!amenity) throw new Error("Amenity not found");

      const existingBookings = await db.getBookingsByAmenityAndDate(input.amenityId, input.date);
      const currentOccupancy = existingBookings
        .filter(b => b.startTime === input.startTime)
        .reduce((sum, b) => sum + b.guestCount, 0);

      if (currentOccupancy + input.guestCount > amenity.capacity) {
        const left = amenity.capacity - currentOccupancy;
        throw new Error(`Capacity exceeded. Only ${left} spots left for this slot.`);
      }

      return db.createBooking({
        userId: ctx.user.id,
        amenityId: input.amenityId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        guestCount: input.guestCount,
        notes: input.notes,
      });
    }),

  cancel: residentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => db.updateBookingStatus(input.id, "cancelled")),

  listAll: staffProcedure.query(async () => db.getBookingsWithDetails()),

  updateStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["confirmed", "pending", "cancelled", "completed"]),
    }))
    .mutation(async ({ input }) => db.updateBookingStatus(input.id, input.status)),
});
