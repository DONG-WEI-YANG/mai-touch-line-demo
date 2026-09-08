import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { occupancyForWindow } from "../_core/bookingCapacity";

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "時間格式需為 HH:MM");
function validateSchedule(openTime: string, closeTime: string, duration: number) {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  if (!time.safeParse(openTime).success || !time.safeParse(closeTime).success
    || !Number.isInteger(duration) || duration <= 0 || minutes(closeTime) - minutes(openTime) < duration) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "開放時間須早於關閉時間，且至少容納一個預約時段" });
  }
}

export const amenitiesRouter = router({
  list: publicProcedure.query(async () => db.getAllAmenities()),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => db.getAmenityById(input.id)),

  getSlots: publicProcedure
    .input(z.object({ amenityId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const amenity = await db.getAmenityById(input.amenityId);
      if (!amenity || amenity.isActive === false || Number(amenity.isActive) === 0) return [];
      validateSchedule(amenity.openTime, amenity.closeTime, amenity.slotDurationMinutes);

      const existingBookings = await db.getBookingsByAmenityAndDate(input.amenityId, input.date);
      const slots: Array<{ startTime: string; endTime: string; available: boolean; remainingCapacity: number }> = [];
      const [openH, openM] = amenity.openTime.split(":").map(Number);
      const [closeH, closeM] = amenity.closeTime.split(":").map(Number);
      const duration = amenity.slotDurationMinutes;
      let currentMinutes = openH * 60 + openM;
      const endMinutes = closeH * 60 + closeM;

      while (currentMinutes + duration <= endMinutes) {
        const startH = Math.floor(currentMinutes / 60);
        const startM = currentMinutes % 60;
        const endSlotMinutes = currentMinutes + duration;
        const endSlotH = Math.floor(endSlotMinutes / 60);
        const endSlotM = endSlotMinutes % 60;
        const startTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
        const endTime = `${String(endSlotH).padStart(2, "0")}:${String(endSlotM).padStart(2, "0")}`;
        const currentOccupancy = occupancyForWindow(existingBookings, startTime, endTime);
        const remaining = Math.max(0, amenity.capacity - currentOccupancy);
        slots.push({ startTime, endTime, available: remaining > 0, remainingCapacity: remaining });
        currentMinutes += duration;
      }
      return slots;
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().trim().min(1).max(255),
      description: z.string().optional(),
      icon: z.string().default("star"),
      category: z.enum(["recreation", "wellness", "entertainment", "business", "dining", "outdoor"]).default("recreation"),
      capacity: z.number().int().min(1).default(10),
      location: z.string().optional(),
      rules: z.string().optional(),
      openTime: time.default("08:00"),
      closeTime: time.default("22:00"),
      slotDurationMinutes: z.number().int().min(1).max(1440).default(60),
    }))
    .mutation(async ({ input }) => {
      validateSchedule(input.openTime, input.closeTime, input.slotDurationMinutes);
      return db.createAmenity({
      name: input.name,
      description: input.description,
      icon: input.icon,
      category: input.category,
      capacity: input.capacity,
      location: input.location,
      rules: input.rules,
      openTime: input.openTime,
      closeTime: input.closeTime,
      slotDurationMinutes: input.slotDurationMinutes,
      });
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().trim().min(1).max(255).optional(),
      description: z.string().optional(),
      capacity: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
      openTime: time.optional(),
      closeTime: time.optional(),
      location: z.string().optional(),
      rules: z.string().optional(),
      category: z.enum(["recreation", "wellness", "entertainment", "business", "dining", "outdoor"]).optional(),
      slotDurationMinutes: z.number().int().min(1).max(1440).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const before = await db.getAmenityById(id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "找不到設施" });
      validateSchedule(data.openTime ?? before.openTime, data.closeTime ?? before.closeTime,
        data.slotDurationMinutes ?? before.slotDurationMinutes);
      await db.updateAmenity(id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      if (!await db.getAmenityById(input.id)) throw new TRPCError({ code: "NOT_FOUND", message: "找不到設施" });
      if ((await db.getAllBookings()).some((booking) => booking.amenityId === input.id)) {
        throw new TRPCError({ code: "CONFLICT", message: "此設施已有預約紀錄，請改為停用以保留歷史資料" });
      }
      return db.deleteAmenity(input.id);
    }),
});
