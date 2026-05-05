import { residentProcedure, staffProcedure, router } from "../_core/trpc";
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
