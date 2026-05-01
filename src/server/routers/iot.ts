import { residentProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const iotRouter = router({
  myDevices: residentProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    if (!user || !user.unitId) return [];
    return db.getDevicesByUnit(user.unitId);
  }),

  amenityDevices: adminProcedure
    .input(z.object({ amenityId: z.number().optional() }))
    .query(async ({ input }) => db.getDevicesByAmenity(input.amenityId)),

  updateDevice: residentProcedure
    .input(z.object({ deviceId: z.number(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const device = await db.getDeviceById(input.deviceId);
      if (!device) throw new Error("Device not found");

      const user = await db.getUserById(ctx.user.id);
      const canControl = user?.role === "admin" || user?.role === "logistics" || (user?.unitId === device.unitId && device.unitId !== null);
      if (!canControl) throw new Error("Unauthorized to control this device");

      await db.updateDeviceStatus(input.deviceId, input.status);
      return { success: true };
    }),
});
