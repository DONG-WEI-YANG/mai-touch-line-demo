import { residentProcedure, adminProcedure, protectedProcedure, router } from "../_core/trpc";
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

  // protectedProcedure, not residentProcedure: the `canControl` check below is
  // the single authorization decision — it deliberately admits staff so the
  // front desk (and the show-unit showcase) can drive a unit's devices. Guarding
  // with residentProcedure made that staff branch unreachable dead code.
  updateDevice: protectedProcedure
    .input(z.object({ deviceId: z.number(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const device = await db.getDeviceById(input.deviceId);
      if (!device) throw new Error("Device not found");

      // 角色的事實來源是 ctx.user(已通過認證),不是資料庫。員工可能以 token
      // 登入,users 表裡根本沒有對應列 —— 去 DB 重查 actor 角色會查無此人而誤擋。
      const role = ctx.user.role;
      if (role !== "admin" && role !== "logistics") {
        // 住戶只能控制自己家的設備,這一項才需要查 DB(要拿 unitId)。
        const resident = await db.getUserById(ctx.user.id);
        const ownsDevice = device.unitId !== null && resident?.unitId === device.unitId;
        if (!ownsDevice) throw new Error("Unauthorized to control this device");
      }

      await db.updateDeviceStatus(input.deviceId, input.status);
      return { success: true };
    }),
});
