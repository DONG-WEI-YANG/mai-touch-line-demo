import { residentProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const financeRouter = router({
  myWallet: residentProcedure.query(async ({ ctx }) => db.getUserWallet(ctx.user.id)),
  history: residentProcedure.query(async ({ ctx }) => db.getUserTransactions(ctx.user.id)),
});
