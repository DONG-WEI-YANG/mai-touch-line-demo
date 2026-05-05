import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, residentProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";
import * as db from "../db";

const BIND_CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LINE_BOT_BASIC_ID = process.env.LINE_BOT_BASIC_ID || ""; // e.g. "@123abc"

/** 6-char base32-ish code without ambiguous chars (no 0/O, 1/I/L). */
function generateBindCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  updateProfile: residentProcedure
    .input(z.object({ name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, input);
      return { success: true };
    }),

  /**
   * Issue a one-time bind code so the web user can link their account to a
   * LINE friend. Returns code + a deep-link URL that opens the bot chat with
   * the bind command pre-filled, so the resident only needs to tap "Send".
   */
  startLineBind: protectedProcedure.mutation(({ ctx }) => {
    const sqlite = ctx.lineAdmin?.db;
    if (!sqlite) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "LINE integration not configured on this server" });
    }
    const code = generateBindCode();
    const expiresAt = new Date(Date.now() + BIND_CODE_TTL_MS).toISOString();
    sqlite.prepare(`
      INSERT INTO bind_codes (code, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(code, ctx.user.id, expiresAt);
    // line.me/R/oaMessage/<basicId>/?<text> opens bot chat with text pre-filled
    const text = `/bind ${code}`;
    const deepLink = LINE_BOT_BASIC_ID
      ? `https://line.me/R/oaMessage/${encodeURIComponent(LINE_BOT_BASIC_ID)}/?${encodeURIComponent(text)}`
      : "";
    return { code, expiresAt, deepLink, command: text };
  }),

  /** Poll-friendly: caller checks current bind state of their user. */
  bindStatus: protectedProcedure.query(({ ctx }) => {
    const sqlite = ctx.lineAdmin?.db;
    if (!sqlite) return { bound: false, lineUserId: null as string | null };
    const row = sqlite.prepare(`
      SELECT line_user_id FROM line_user
      WHERE app_user_id = ? AND channel_id = ?
      LIMIT 1
    `).get(ctx.user.id, ctx.lineAdmin?.channelId ?? "default") as { line_user_id: string } | undefined;
    return { bound: !!row, lineUserId: row?.line_user_id ?? null };
  }),

  /** Optional: drop the link so the user can rebind to a different LINE id. */
  unbindLine: protectedProcedure.mutation(({ ctx }) => {
    const sqlite = ctx.lineAdmin?.db;
    if (!sqlite) return { unbound: false };
    sqlite.prepare(`
      UPDATE line_user SET app_user_id = NULL
      WHERE app_user_id = ? AND channel_id = ?
    `).run(ctx.user.id, ctx.lineAdmin?.channelId ?? "default");
    return { unbound: true };
  }),
});
