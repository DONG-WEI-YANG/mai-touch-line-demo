import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const accessRouter = router({
  logEntry: protectedProcedure
    .input(z.object({
      passId: z.number().optional(),
      entryPoint: z.string(),
      result: z.enum(["success", "denied", "expired"]),
    }))
    .mutation(async ({ input }) => db.createAccessLog(input)),

  liveFeed: adminProcedure.query(async () => db.getLatestAccessLogs(20)),
});
