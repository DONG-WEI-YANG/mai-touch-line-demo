import { residentProcedure, staffProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { assertWithinCapacity } from "../_core/bookingCapacity";
import { runExclusive } from "../_core/keyedLock";

export const bookingsRouter = router({
  myBookings: residentProcedure.query(async ({ ctx }) => db.getUserBookings(ctx.user.id)),

  create: residentProcedure
    .input(z.object({
      amenityId: z.number(),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      guestCount: z.number().int().min(1).default(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const amenity = await db.getAmenityById(input.amenityId);
      if (!amenity) throw new TRPCError({ code: "NOT_FOUND", message: "Amenity not found" });

      // Serialize the read→check→write for this exact slot so two concurrent
      // requests can't both pass the capacity check and overbook (audit race).
      return runExclusive(`booking:${input.amenityId}:${input.date}:${input.startTime}`, async () => {
        const existingBookings = await db.getBookingsByAmenityAndDate(input.amenityId, input.date);
        try {
          assertWithinCapacity({
            existing: existingBookings,
            startTime: input.startTime,
            endTime: input.endTime,
            guestCount: input.guestCount,
            capacity: amenity.capacity,
          });
        } catch (err) {
          throw new TRPCError({ code: "CONFLICT", message: err instanceof Error ? err.message : "Capacity exceeded" });
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
      });
    }),

  cancel: residentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Ownership check (audit finding B / IDOR): a resident may only cancel
      // their OWN booking — never an arbitrary id belonging to someone else.
      const booking = await db.getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      if (booking.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only cancel your own booking." });
      }
      return db.updateBookingStatus(input.id, "cancelled");
    }),

  listAll: staffProcedure.query(async () => db.getBookingsWithDetails()),

  updateStatus: staffProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["confirmed", "pending", "cancelled", "completed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const before = await db.getBookingById(input.id);
      await db.updateBookingStatus(input.id, input.status);
      if (before && ctx.lineAdmin?.pushToLineUser) {
        try {
          const row = ctx.lineAdmin.db.prepare(
            `SELECT line_user_id FROM line_user WHERE app_user_id = ? AND channel_id = ? LIMIT 1`
          ).get(before.userId, ctx.lineAdmin.channelId) as { line_user_id: string } | undefined;
          if (row?.line_user_id) {
            const statusZh: Record<string, string> = {
              confirmed: '已確認', pending: '待確認', cancelled: '已取消', completed: '已完成',
            };
            const msg = `預約 #BK-${input.id} 狀態更新:${statusZh[input.status] ?? input.status}`;
            await ctx.lineAdmin.pushToLineUser(row.line_user_id, msg);
          }
        } catch (err) {
          console.error('[bookings.updateStatus] LINE push-back failed', { id: input.id, err });
        }
      }
    }),
});
