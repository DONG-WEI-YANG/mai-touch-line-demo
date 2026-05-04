import { residentProcedure, adminProcedure, staffProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const workOrdersRouter = router({
  myOrders: residentProcedure.query(async ({ ctx }) => db.getUserWorkOrders(ctx.user.id)),

  create: residentProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      category: z.enum(["maintenance", "security", "concierge", "housekeeping", "other"]).default("maintenance"),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    }))
    .mutation(async ({ ctx, input }) => db.createWorkOrder({
      userId: ctx.user.id,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
    })),

  listAll: staffProcedure.query(async () => db.getWorkOrdersWithDetails()),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      assignedTo: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateWorkOrder(id, data);
    }),
});
