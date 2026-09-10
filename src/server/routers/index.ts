import { requireSimulationMode } from "../services/deviceExecution";
import { publicProcedure, residentProcedure, adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";

// Import domain routers
import { authRouter } from "./auth";
import { voiceRouter } from "./voice";
import { chatRouter } from "./chat";
import { amenitiesRouter } from "./amenities";
import { bookingsRouter } from "./bookings";
import { workOrdersRouter } from "./workOrders";
import { iotRouter } from "./iot";
import { showcaseRouter } from "./showcase";
import { financeRouter } from "./finance";
import { accessRouter } from "./access";
import { adminDashboardRouter } from "./adminRouter";
import { lineAdminRouter } from "./lineAdminRouter";
import { announcementsRouter } from "./announcements";
import { packagesRouter } from "./packages";
import { parkingRouter } from "./parking";
import { getSystemDiagnostics } from "../services/systemDiagnostics";
import { dbManager } from "../database/adapter";

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ status: "ok", timestamp: Date.now() })),

    diagnostics: adminProcedure.query(() => getSystemDiagnostics()),
    notificationQueue: adminProcedure.query(() => {
      if (dbManager.getType() !== 'sqlite') return { configured:false, pending:0, failed:0 };
      const counts = dbManager.getRawSqlite().prepare("SELECT count(*) AS pending, coalesce(sum(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END),0) AS failed FROM notification_outbox WHERE delivered_at IS NULL").get() as {pending:number;failed:number};
      return {configured:true,...counts};
    }),

    activeJobs: residentProcedure.query(async ({ ctx }) => db.getActiveJobsByUser(ctx.user.id)),

    runJob: residentProcedure
      .input(z.object({ type: z.enum(["arrival", "departure", "hosting"]) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user || !user.unitId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "User not assigned to a unit",
          });
        }

        requireSimulationMode();
        const jobId = await db.createSystemJob({
          userId: ctx.user.id, type: input.type, status: "running", progress: 10,
          currentStep: "Simulation: updating demo device records (no device ACK).",
        });
        try {
          const unitDevices = await db.getDevicesByUnit(user.unitId);
          if (input.type === "arrival") {
            const ac = unitDevices.find(d => d.type === "climate");
            if (ac) await db.updateDeviceStatus(ac.id, "22°C");
            const light = unitDevices.find(d => d.type === "light");
            if (light) await db.updateDeviceStatus(light.id, "on");
          } else {
            for (const d of unitDevices) await db.updateDeviceStatus(d.id, "off");
          }
          await db.updateJobProgress(jobId, 100, "Simulation completed: demo records updated; physical devices unconfirmed.");
        } catch {
          await db.updateJobProgress(jobId, 0, "Simulation failed; some demo records may have changed. Physical devices unconfirmed.", "failed");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Simulation failed; check device records before retrying." });
        }
        return { jobId, executionMode: "simulation" as const, acknowledged: false };
      }),
  }),

  auth: authRouter,
  voice: voiceRouter,
  chat: chatRouter,
  amenities: amenitiesRouter,
  bookings: bookingsRouter,
  workOrders: workOrdersRouter,
  iot: iotRouter,
  showcase: showcaseRouter,
  finance: financeRouter,
  access: accessRouter,
  admin: adminDashboardRouter,
  lineAdmin: lineAdminRouter,
  announcements: announcementsRouter,
  packages: packagesRouter,
  parking: parkingRouter,
});

export type AppRouter = typeof appRouter;
