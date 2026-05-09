import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, protectedProcedure, router } from '../_core/trpc';
import { dbManager } from '../database/adapter';
import { makeAnnouncementsRepo, type AnnouncementsRepo } from '../announcements-repo';

// Lazy singleton — the raw SQLite handle isn't ready at module load (db must
// connect first), so resolve on first call. Failures bubble up as TRPCError.
let cachedRepo: AnnouncementsRepo | null = null;
function getRepo(): AnnouncementsRepo {
  if (cachedRepo) return cachedRepo;
  try {
    const sqlite = dbManager.getRawSqlite();
    cachedRepo = makeAnnouncementsRepo(sqlite);
    return cachedRepo;
  } catch (err) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Announcements not available: ${(err as Error).message}`,
    });
  }
}

export function resetAnnouncementsRepoForTests(): void {
  cachedRepo = null;
}

export function setAnnouncementsRepoForTests(repo: AnnouncementsRepo): void {
  cachedRepo = repo;
}

const audienceSchema = z.enum(['all', 'resident', 'staff']);

export const announcementsRouter = router({
  // Resident-readable list. Filters out 'staff'-only items unless caller is staff.
  list: protectedProcedure.query(({ ctx }) => {
    const audience = ctx.user.role === 'admin' || ctx.user.role === 'logistics'
      ? 'staff'
      : 'resident';
    return getRepo().list(audience);
  }),

  // Admin-only: see everything including expired/staff-only.
  listAll: adminProcedure.query(() => getRepo().listAll()),

  create: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(5000),
      audience: audienceSchema.default('all'),
      isPinned: z.boolean().default(false),
      expiresAt: z.string().datetime().nullish(),
    }))
    .mutation(({ ctx, input }) => {
      const id = getRepo().create({
        title: input.title,
        body: input.body,
        audience: input.audience,
        isPinned: input.isPinned,
        postedBy: ctx.user.id,
        expiresAt: input.expiresAt ?? null,
      });
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).max(200).optional(),
      body: z.string().min(1).max(5000).optional(),
      audience: audienceSchema.optional(),
      isPinned: z.boolean().optional(),
      expiresAt: z.string().datetime().nullish(),
    }))
    .mutation(({ input }) => {
      // Explicit destructure: tRPC v10's input-type inference here makes all
      // fields optional, which conflicts with the repo's `id: number` requirement.
      // Pass id explicitly + spread the rest.
      const { id, ...patch } = input;
      const updated = getRepo().update({ id, ...patch });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'announcement not found' });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => {
      const ok = getRepo().delete(input.id);
      if (!ok) throw new TRPCError({ code: 'NOT_FOUND', message: 'announcement not found' });
      return { success: true };
    }),
});
