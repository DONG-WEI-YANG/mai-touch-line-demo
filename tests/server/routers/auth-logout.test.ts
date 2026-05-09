import { describe, expect, it, vi } from "vitest";
import { authRouter } from "../../../src/server/routers/auth";
import { COOKIE_NAME } from "../../../src/shared/const";

type CookieClear = { name: string; options: Record<string, unknown> };

function makeCtx(opts: { protocol?: "http" | "https" } = {}) {
  const cleared: CookieClear[] = [];
  const ctx: any = {
    user: null,
    req: {
      protocol: opts.protocol ?? "https",
      headers: {},
    },
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cleared.push({ name, options });
      },
    },
  };
  return { ctx, cleared };
}

describe("authRouter.logout", () => {
  it("clears the session cookie and returns success (https → secure cookie)", async () => {
    const { ctx, cleared } = makeCtx({ protocol: "https" });
    const caller = authRouter.createCaller(ctx);

    const result = await caller.logout();

    expect(result).toEqual({ success: true });
    expect(cleared).toHaveLength(1);
    expect(cleared[0].name).toBe(COOKIE_NAME);
    expect(cleared[0].options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: -1,
    });
  });

  it("clears with lax sameSite when request is not https (local dev)", async () => {
    const { ctx, cleared } = makeCtx({ protocol: "http" });
    const caller = authRouter.createCaller(ctx);

    await caller.logout();

    expect(cleared[0].options).toMatchObject({
      secure: false,
      sameSite: "lax",
      maxAge: -1,
    });
  });

  it("logout works without an authenticated user (publicProcedure semantics)", async () => {
    const { ctx, cleared } = makeCtx();
    ctx.user = null;
    const caller = authRouter.createCaller(ctx);

    await expect(caller.logout()).resolves.toEqual({ success: true });
    expect(cleared).toHaveLength(1);
  });
});

describe("authRouter.startLineBind", () => {
  const originalEnv = process.env.LINE_BOT_BASIC_ID;

  function makeProtectedCtx() {
    const stmts: Array<{ sql: string; args: unknown[] }> = [];
    const fakeDb = {
      prepare(sql: string) {
        return {
          run: (...args: unknown[]) => {
            stmts.push({ sql, args });
            return { changes: 1 };
          },
        };
      },
    };
    const ctx: any = {
      user: { id: 42, role: "resident" },
      req: { protocol: "https", headers: {} },
      res: { clearCookie: vi.fn() },
      lineAdmin: { db: fakeDb, channelId: "default" },
    };
    return { ctx, stmts };
  }

  it("returns empty deepLink when LINE_BOT_BASIC_ID is unset (no demo fallback)", async () => {
    delete process.env.LINE_BOT_BASIC_ID;
    const { ctx } = makeProtectedCtx();
    const caller = authRouter.createCaller(ctx);

    const r = await caller.startLineBind();

    expect(r.code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
    expect(r.deepLink).toBe("");
    expect(r.command).toBe(`/bind ${r.code}`);

    if (originalEnv !== undefined) process.env.LINE_BOT_BASIC_ID = originalEnv;
  });

  it("builds deepLink from current env (read at call-time)", async () => {
    process.env.LINE_BOT_BASIC_ID = "@testbot";
    const { ctx } = makeProtectedCtx();
    const caller = authRouter.createCaller(ctx);

    const r = await caller.startLineBind();

    expect(r.deepLink).toBe(
      `https://line.me/R/oaMessage/${encodeURIComponent("@testbot")}/?${encodeURIComponent(r.command)}`,
    );

    if (originalEnv === undefined) delete process.env.LINE_BOT_BASIC_ID;
    else process.env.LINE_BOT_BASIC_ID = originalEnv;
  });
});
