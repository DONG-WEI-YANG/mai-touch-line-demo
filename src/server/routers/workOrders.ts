import { residentProcedure, staffProcedure, router } from "../_core/trpc";
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

  update: staffProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      assignedTo: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const before = await db.getWorkOrderById(id);
      await db.updateWorkOrder(id, data);
      // Push status change back to the original LINE requester (if bound).
      // Best-effort: log + swallow errors so the mutation always succeeds for
      // logistics even when the LINE webhook is degraded.
      if (input.status && before && ctx.lineAdmin?.pushToLineUser) {
        try {
          const adminDb = ctx.lineAdmin.db;
          const row = adminDb.prepare(
            `SELECT line_user_id FROM line_user WHERE app_user_id = ? AND channel_id = ? LIMIT 1`
          ).get(before.userId, ctx.lineAdmin.channelId) as { line_user_id: string } | undefined;
          if (row?.line_user_id) {
            const statusZh: Record<string, string> = {
              open: '已建立', in_progress: '處理中', resolved: '已完成', closed: '已關閉',
            };
            const msg = `工單 #WO-${id}「${before.title}」狀態更新:${statusZh[input.status] ?? input.status}`;
            await ctx.lineAdmin.pushToLineUser(row.line_user_id, msg);
          }
        } catch (err) {
          console.error('[workOrders.update] LINE push-back failed', { id, err });
        }
      }
    }),
});
