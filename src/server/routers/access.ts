import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const accessRouter = router({
  logEntry: protectedProcedure
    .input(z.object({
      passId: z.number().optional(),
      entryPoint: z.string().trim().min(1).max(255),
      result: z.enum(["success", "denied", "expired"]),
    }))
    // This endpoint is a demonstration report, never evidence of a gate ACK.
    .mutation(async ({ input, ctx }) => {
      await db.createAccessLog({ ...input, userId: ctx.user.id, source: 'demo' });
      return { source: 'demo' as const, trusted: false as const };
    }),

  liveFeed: adminProcedure.query(async () => (await db.getLatestAccessLogs(20)).map(log => ({
    ...log, source: log.source || 'unverified', trusted: false as const,
  }))),
});
