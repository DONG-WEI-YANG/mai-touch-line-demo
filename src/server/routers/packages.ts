import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, residentProcedure, staffProcedure, router } from '../_core/trpc';
import { dbManager } from '../database/adapter';
import { makePackagesRepo, type PackagesRepo } from '../packages-repo';

let cachedRepo: PackagesRepo | null = null;
function getRepo(): PackagesRepo {
  if (cachedRepo) return cachedRepo;
  try {
    cachedRepo = makePackagesRepo(dbManager.getRawSqlite());
    return cachedRepo;
  } catch (err) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Packages not available: ${(err as Error).message}`,
    });
  }
}

export function resetPackagesRepoForTests(): void {
  cachedRepo = null;
}
export function setPackagesRepoForTests(repo: PackagesRepo): void {
  cachedRepo = repo;
}

export const packagesRouter = router({
  myPending: residentProcedure.query(({ ctx }) => getRepo().myPending(ctx.user.id)),
  myAll: residentProcedure.query(({ ctx }) => getRepo().myAll(ctx.user.id)),

  list: staffProcedure.query(() => getRepo().listAll()),

  register: staffProcedure
    .input(z.object({
      recipientId: z.number().int().positive(),
      sender: z.string().max(200).nullish(),
      courier: z.string().max(64).nullish(),
      storageLocation: z.string().max(200).nullish(),
      notes: z.string().max(500).nullish(),
    }))
    .mutation(({ ctx, input }) => getRepo().register({
      recipientId: input.recipientId,
      sender: input.sender ?? null,
      courier: input.courier ?? null,
      storageLocation: input.storageLocation ?? null,
      notes: input.notes ?? null,
      registeredBy: ctx.user.id,
    })),

  markPickedUp: staffProcedure
    .input(z.object({
      id: z.number().int().positive(),
      pickedUpBy: z.string().min(1).max(100),
    }))
    .mutation(({ input }) => {
      const ok = getRepo().markPickedUp(input.id, input.pickedUpBy);
      if (!ok) throw new TRPCError({ code: 'NOT_FOUND', message: 'package missing or already picked up' });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => {
      const ok = getRepo().delete(input.id);
      if (!ok) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),
});
