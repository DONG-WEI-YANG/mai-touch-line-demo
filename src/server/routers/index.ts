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
import { financeRouter } from "./finance";
import { accessRouter } from "./access";
import { adminDashboardRouter } from "./adminRouter";
import { lineAdminRouter } from "./lineAdminRouter";

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ status: "ok", timestamp: Date.now() })),

    diagnostics: adminProcedure.query(async () => {
      let dbStatus = "connected";
      try { await db.getDb(); } catch { dbStatus = "error"; }
      let nlpStatus = "online";
      try {
        const res = await fetch("http://localhost:8000/health");
        if (!res.ok) nlpStatus = "degraded";
      } catch { nlpStatus = "offline"; }
      const forgeConfigured = !!process.env.EXPO_PUBLIC_API_KEY && process.env.EXPO_PUBLIC_API_KEY !== "mock-key";
      return {
        services: {
          database: { status: dbStatus, type: "SQLite" },
          nlp_engine: { status: nlpStatus, url: "http://localhost:8000" },
          forge_api: { configured: forgeConfigured, status: forgeConfigured ? "ready" : "unconfigured" }
        },
        environment: process.env.NODE_ENV || "development"
      };
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

        const jobId = await db.createSystemJob({
          userId: ctx.user.id, type: input.type, status: "running", progress: 10,
          currentStep: `Locating devices in Unit ${user.unitNumber}...`,
        });

        (async () => {
          try {
            const unitDevices = await db.getDevicesByUnit(user.unitId!);
            if (input.type === "arrival") {
              await new Promise(r => setTimeout(r, 1500));
              const ac = unitDevices.find(d => d.type === "climate");
              if (ac) await db.updateDeviceStatus(ac.id, "22°C");
              await db.updateJobProgress(jobId, 40, `Setting ${ac?.name || "AC"} to 22°C...`);
              await new Promise(r => setTimeout(r, 1500));
              const light = unitDevices.find(d => d.type === "light");
              if (light) await db.updateDeviceStatus(light.id, "on");
              await db.updateJobProgress(jobId, 70, `Illuminating ${light?.name || "Entryway"}...`);
              await new Promise(r => setTimeout(r, 1500));
              await db.updateJobProgress(jobId, 100, `Unit ${user.unitNumber} is ready. Welcome home.`);
            } else {
              for (const d of unitDevices) { await db.updateDeviceStatus(d.id, "off"); }
              await db.updateJobProgress(jobId, 100, "All systems secured. Energy saving mode active.");
            }
          } catch {
            await db.updateJobProgress(jobId, 0, "Dispatch failed: Hardware timeout.");
          }
        })();
        return { jobId };
      }),
  }),

  auth: authRouter,
  voice: voiceRouter,
  chat: chatRouter,
  amenities: amenitiesRouter,
  bookings: bookingsRouter,
  workOrders: workOrdersRouter,
  iot: iotRouter,
  finance: financeRouter,
  access: accessRouter,
  admin: adminDashboardRouter,
  lineAdmin: lineAdminRouter,
});

export type AppRouter = typeof appRouter;
