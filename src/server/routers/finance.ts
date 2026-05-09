import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, residentProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { dbManager } from '../database/adapter';
import { makeInvoicesRepo, type InvoicesRepo } from '../invoices-repo';

let cachedInvoicesRepo: InvoicesRepo | null = null;
function getInvoicesRepo(): InvoicesRepo {
  if (cachedInvoicesRepo) return cachedInvoicesRepo;
  try {
    cachedInvoicesRepo = makeInvoicesRepo(dbManager.getRawSqlite());
    return cachedInvoicesRepo;
  } catch (err) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Invoices not available: ${(err as Error).message}`,
    });
  }
}

export function resetInvoicesRepoForTests(): void { cachedInvoicesRepo = null; }
export function setInvoicesRepoForTests(repo: InvoicesRepo): void { cachedInvoicesRepo = repo; }

const paidMethodSchema = z.enum(['cash', 'transfer', 'autodebit', 'manual', 'card']);

export const financeRouter = router({
  myWallet: residentProcedure.query(async ({ ctx }) => db.getUserWallet(ctx.user.id)),
  history: residentProcedure.query(async ({ ctx }) => db.getUserTransactions(ctx.user.id)),

  // ── Invoices ────────────────────────────────────────────────────────────
  myInvoices: residentProcedure.query(({ ctx }) => getInvoicesRepo().myAll(ctx.user.id)),
  myUnpaid: residentProcedure.query(({ ctx }) => ({
    invoices: getInvoicesRepo().myUnpaid(ctx.user.id),
    summary: getInvoicesRepo().summaryFor(ctx.user.id),
  })),

  invoicesList: adminProcedure.query(() => getInvoicesRepo().listAll()),

  issueInvoice: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      description: z.string().min(1).max(200),
      amountCents: z.number().int().min(0),
      currency: z.string().length(3).default('TWD'),
      dueDate: z.string().date().nullish(),
      notes: z.string().max(500).nullish(),
    }))
    .mutation(({ ctx, input }) => ({
      id: getInvoicesRepo().issue({
        userId: input.userId,
        description: input.description,
        amountCents: input.amountCents,
        currency: input.currency,
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
        issuedBy: ctx.user.id,
      }),
    })),

  markInvoicePaid: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      method: paidMethodSchema.default('manual'),
    }))
    .mutation(({ input }) => {
      const ok = getInvoicesRepo().markPaid(input.id, input.method);
      if (!ok) throw new TRPCError({ code: 'NOT_FOUND', message: 'invoice missing or already paid' });
      return { success: true };
    }),

  deleteInvoice: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => {
      const ok = getInvoicesRepo().delete(input.id);
      if (!ok) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),
});
