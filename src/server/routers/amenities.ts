import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const amenitiesRouter = router({
  list: publicProcedure.query(async () => db.getAllAmenities()),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => db.getAmenityById(input.id)),

  getSlots: publicProcedure
    .input(z.object({ amenityId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const amenity = await db.getAmenityById(input.amenityId);
      if (!amenity) return [];

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
        const currentOccupancy = existingBookings.filter(b => b.startTime === startTime).reduce((sum, b) => sum + b.guestCount, 0);
        const remaining = Math.max(0, amenity.capacity - currentOccupancy);
        slots.push({ startTime, endTime, available: remaining > 0, remainingCapacity: remaining });
        currentMinutes += duration;
      }
      return slots;
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      icon: z.string().default("star"),
      category: z.enum(["recreation", "wellness", "entertainment", "business", "dining", "outdoor"]).default("recreation"),
      capacity: z.number().min(1).default(10),
      location: z.string().optional(),
      rules: z.string().optional(),
      openTime: z.string().default("08:00"),
      closeTime: z.string().default("22:00"),
      slotDurationMinutes: z.number().default(60),
    }))
    .mutation(async ({ input }) => db.createAmenity({
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
    })),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      capacity: z.number().min(1).optional(),
      isActive: z.boolean().optional(),
      openTime: z.string().optional(),
      closeTime: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateAmenity(id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => db.deleteAmenity(input.id)),
});
