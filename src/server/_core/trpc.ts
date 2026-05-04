/**
 * tRPC initialization and procedure definitions
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

// Initialize tRPC with context
const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

// Export reusable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Now TypeScript knows user is not null
    },
  });
});

/**
 * Admin procedure - requires admin role
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be an admin to access this resource",
    });
  }


  return next({ ctx });
});

/**
 * Resident procedure - requires resident role
 */
export const residentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "resident") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a resident to access this resource",
    });
  }

  return next({ ctx });
});

/**
 * Logistics procedure - requires logistics role
 */
export const logisticsProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "logistics") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a logistics user to access this resource",
    });
  }

  return next({ ctx });
});

/**
 * Staff procedure — admin OR logistics. For shared back-office views like the
 * work-order list (admins triage, logistics execute) where both roles legitimately
 * need read access. Residents are still excluded.
 */
export const staffProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "logistics") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be staff (admin or logistics) to access this resource",
    });
  }

  return next({ ctx });
});
