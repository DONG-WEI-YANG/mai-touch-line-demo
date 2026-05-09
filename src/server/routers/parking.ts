import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, protectedProcedure, residentProcedure, staffProcedure, router } from '../_core/trpc';
import { dbManager } from '../database/adapter';
import { makeParkingRepo, type ParkingRepo } from '../parking-repo';

let cachedRepo: ParkingRepo | null = null;
function getRepo(): ParkingRepo {
  if (cachedRepo) return cachedRepo;
  try {
    cachedRepo = makeParkingRepo(dbManager.getRawSqlite());
    return cachedRepo;
  } catch (err) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Parking not available: ${(err as Error).message}`,
    });
  }
}

export function resetParkingRepoForTests(): void { cachedRepo = null; }
export function setParkingRepoForTests(repo: ParkingRepo): void { cachedRepo = repo; }

const spotTypeSchema = z.enum(['resident', 'guest', 'ev']);
const purposeSchema = z.enum(['resident_lease', 'visitor', 'ev_charge', 'staff']);

export const parkingRouter = router({
  spots: staffProcedure.query(() => getRepo().spots()),
  myAssignments: residentProcedure.query(({ ctx }) => getRepo().activeForUser(ctx.user.id)),
  recent: staffProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(({ input }) => getRepo().recent(input.limit)),

  addSpot: adminProcedure
    .input(z.object({
      label: z.string().min(1).max(32),
      type: spotTypeSchema.default('resident'),
      zone: z.string().max(32).nullish(),
      isActive: z.boolean().default(true),
      notes: z.string().max(200).nullish(),
    }))
    .mutation(({ input }) => ({
      id: getRepo().addSpot({
        label: input.label, type: input.type,
        zone: input.zone ?? null,
        isActive: input.isActive,
        notes: input.notes ?? null,
      }),
    })),

  removeSpot: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => {
      const ok = getRepo().removeSpot(input.id);
      if (!ok) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  assign: staffProcedure
    .input(z.object({
      spotId: z.number().int().positive(),
      userId: z.number().int().positive().nullable(),
      vehiclePlate: z.string().min(2).max(16),
      driverName: z.string().max(100).nullish(),
      purpose: purposeSchema.default('visitor'),
      endAt: z.string().datetime().nullable().optional(),
    }))
    .mutation(({ input }) => {
      try {
        const id = getRepo().assign({
          spotId: input.spotId,
          userId: input.userId,
          vehiclePlate: input.vehiclePlate,
          driverName: input.driverName ?? null,
          purpose: input.purpose,
          endAt: input.endAt ?? null,
        });
        return { id };
      } catch (err) {
        throw new TRPCError({ code: 'CONFLICT', message: (err as Error).message });
      }
    }),

  requestVisitor: residentProcedure
    .input(z.object({
      vehiclePlate: z.string().min(2).max(16),
      driverName: z.string().max(100).nullish(),
      endAt: z.string().datetime().nullable().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const r = getRepo().requestVisitor({
        userId: ctx.user.id,
        vehiclePlate: input.vehiclePlate,
        driverName: input.driverName ?? null,
        endAt: input.endAt ?? null,
      });
      if (!r) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No guest parking spots available right now',
        });
      }
      return r;
    }),

  // Any authenticated user, but residents are restricted to releasing their own
  // assignment (staff can release any). The role check lives inside the handler
  // because the access policy is data-dependent, not purely role-based.
  release: protectedProcedure
    .input(z.object({ assignmentId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => {
      const a = getRepo().getAssignmentRaw(input.assignmentId);
      if (!a) throw new TRPCError({ code: 'NOT_FOUND' });
      const isStaff = ctx.user.role === 'admin' || ctx.user.role === 'logistics';
      if (!isStaff && a.user_id !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your assignment' });
      }
      const ok = getRepo().release(input.assignmentId);
      if (!ok) throw new TRPCError({ code: 'CONFLICT', message: 'Already released' });
      return { success: true };
    }),
});
