import { router, adminProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listScripts } from '../line/demo-scripts';
import { startDemo } from '../line/handlers/demo';

function createLineNotConfiguredError(): TRPCError {
  return new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: 'LINE not configured (LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN not set)',
  });
}

function requireLineAdmin(ctx: { lineAdmin?: unknown }): asserts ctx is { lineAdmin: Exclude<typeof ctx.lineAdmin, undefined | null> } {
  if (!ctx.lineAdmin) {
    throw createLineNotConfiguredError();
  }
}

// Helper: admin + ctx.lineAdmin must be present (LINE configured at boot)
const adminLineProcedure = adminProcedure.use(({ ctx, next }) => {
  requireLineAdmin(ctx);
  return next({ ctx: { ...ctx, lineAdmin: ctx.lineAdmin } });
});

export const lineAdminRouter = router({
  // ─────── A1. Logs ───────
  logsList: adminProcedure.input(z.object({
    limit:      z.number().min(1).max(500).default(100),
    cursor:     z.number().optional(),                    // line_message_log.id
    intent:     z.string().optional(),
    direction:  z.enum(['inbound', 'outbound', 'outbound:debug']).optional(),
    lineUserId: z.string().optional(),
  })).query(({ ctx, input }) => {
    if (!ctx.lineAdmin) {
      return { items: [], nextCursor: undefined };
    }
    const where: string[] = [];
    const params: unknown[] = [];
    if (input.cursor !== undefined) { where.push('id < ?'); params.push(input.cursor); }
    if (input.intent)               { where.push('intent = ?'); params.push(input.intent); }
    if (input.direction)            { where.push('direction = ?'); params.push(input.direction); }
    if (input.lineUserId)           { where.push('line_user_id = ?'); params.push(input.lineUserId); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = ctx.lineAdmin.db.prepare(
      `SELECT id, line_user_id as lineUserId, direction, message_type as messageType,
              content, intent, session_id as sessionId, created_at as createdAt
       FROM line_message_log ${whereSql}
       ORDER BY id DESC LIMIT ?`
    ).all(...params, input.limit + 1) as Array<{ id: number; lineUserId: string; direction: string; messageType: string; content: string | null; intent: string | null; sessionId: string | null; createdAt: string }>;

    let nextCursor: number | undefined;
    if (rows.length > input.limit) {
      const next = rows.pop();
      nextCursor = next?.id;
    }
    return { items: rows, nextCursor };
  }),

  // ─────── A2. Config ───────
  configList: adminProcedure.query(({ ctx }) => {
    if (!ctx.lineAdmin) return [];
    return ctx.lineAdmin.db.prepare(
      `SELECT key, value, type, description, updated_at as updatedAt, updated_by as updatedBy
       FROM runtime_config ORDER BY key`
    ).all() as Array<{ key: string; value: string; type: string; description: string | null; updatedAt: string; updatedBy: string | null }>;
  }),

  configSet: adminLineProcedure.input(z.object({
    key:   z.string().min(1).max(100),
    value: z.unknown(),
  })).mutation(async ({ ctx, input }) => {
    // Per-key validation: limit ranges to prevent DoS / misconfig
    const validated = validateConfigValue(input.key, input.value);
    if (validated.ok === false) throw new TRPCError({ code: 'BAD_REQUEST', message: validated.error });
    await ctx.lineAdmin.runtimeConfig.set(input.key, validated.value, ctx.user.email);
    return { ok: true as const };
  }),

  // ─────── A3. Scripts ───────
  scriptsList: adminProcedure.query(() => {
    return listScripts().map(s => ({
      id: s.id,
      name: s.title['zh-TW'] || s.id,
      description: `Automated flow for ${s.id}`,
      category: s.id === 'repair' ? 'maintenance' : s.id === 'facility' ? 'amenity' : 'concierge',
      steps: s.steps.map(step => {
          if (step.kind === 'bot_say') return `Bot: ${typeof step.message === 'string' ? step.message : 'Flex Message'}`;
          if (step.kind === 'wait_user') return `Wait: ${step.expect}`;
          if (step.kind === 'simulate_housekeeper') return `Staff: ${step.message}`;
          if (step.kind === 'side_effect') return `System: ${step.trpcCall.procedure}`;
          return (step as { kind: string }).kind;
        })
    }));
  }),

  scriptRun: adminLineProcedure.input(z.object({
    id: z.string(),
  })).mutation(async ({ ctx, input }) => {
    // Find the LINE user bound to this admin account
    const row = ctx.lineAdmin.db.prepare(
      `SELECT line_user_id FROM line_user WHERE app_user_id = ? AND channel_id = ? LIMIT 1`
    ).get(ctx.user.id, ctx.lineAdmin.channelId) as { line_user_id: string } | undefined;

    if (!row) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Your admin account is not bound to a LINE user. Please bind your account first.',
      });
    }

    const deps = {
      store: ctx.lineAdmin.sessionStore,
      client: ctx.lineAdmin.lineClient,
      lineUser: { lineUserId: row.line_user_id, language: 'zh-TW' as const },
      runSideEffect: ctx.lineAdmin.runSideEffect,
    };

    await startDemo(input.id, deps);
    return { ok: true, message: `Script ${input.id} started on your LINE device.` };
  }),

  scriptsConfig: adminProcedure.query(({ ctx }) => {
    if (!ctx.lineAdmin) return [];
    return ctx.lineAdmin.db.prepare(
      `SELECT id, enabled, steps_json as stepsJson, updated_at as updatedAt FROM demo_script_config`
    ).all() as Array<{ id: string; enabled: number; stepsJson: string | null; updatedAt: string }>;
  }),

  scriptsSetEnabled: adminLineProcedure.input(z.object({
    id:      z.enum(['facility', 'repair', 'visitor', 'complaint']),
    enabled: z.boolean(),
  })).mutation(({ ctx, input }) => {
    ctx.lineAdmin.db.prepare(
      `UPDATE demo_script_config SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(input.enabled ? 1 : 0, input.id);
    return { ok: true as const };
  }),

  scriptsSetSteps: adminLineProcedure.input(z.object({
    id:    z.enum(['facility', 'repair', 'visitor', 'complaint']),
    steps: z.array(z.unknown()).max(50),  // upper bound to prevent runaway
  })).mutation(({ ctx, input }) => {
    ctx.lineAdmin.db.prepare(
      `UPDATE demo_script_config SET steps_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(JSON.stringify(input.steps), input.id);
    return { ok: true as const };
  }),

  // ─────── A4. Users ───────
  usersList: adminProcedure.input(z.object({
    role:   z.enum(['resident', 'housekeeper', 'admin']).optional(),
    isDemo: z.boolean().optional(),
  })).query(({ ctx, input }) => {
    if (!ctx.lineAdmin) return [];
    const where: string[] = [];
    const params: unknown[] = [];
    if (input.role !== undefined)   { where.push('lu.role = ?'); params.push(input.role); }
    if (input.isDemo !== undefined) { where.push('lu.is_demo = ?'); params.push(input.isDemo ? 1 : 0); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    return ctx.lineAdmin.db.prepare(
      `SELECT lu.id, lu.channel_id as channelId, lu.line_user_id as lineUserId, lu.app_user_id as appUserId,
              lu.role, lu.display_name as displayName, lu.picture_url as pictureUrl, lu.language, lu.is_demo as isDemo,
              lu.created_at as createdAt, lu.updated_at as updatedAt,
              u.name as realUserName, u.id as realUserId, u.role as realUserRole
       FROM line_user lu
       LEFT JOIN users u ON u.id = lu.app_user_id
       ${whereSql} ORDER BY lu.id DESC LIMIT 200`
    ).all(...params);
  }),

  usersSetRole: adminLineProcedure.input(z.object({
    lineUserId: z.string().regex(/^U[0-9a-fA-F]{32}$/),
    role:       z.enum(['resident', 'housekeeper', 'admin']),
  })).mutation(({ ctx, input }) => {
    ctx.lineAdmin.lineUserRepo.setRole(ctx.lineAdmin.channelId, input.lineUserId, input.role);
    return { ok: true as const };
  }),

  usersPurgeDemo: adminLineProcedure.mutation(({ ctx }) => {
    const result = ctx.lineAdmin.db.prepare(`DELETE FROM line_user WHERE is_demo = 1`).run();
    return { deletedCount: result.changes };
  }),

  // ─────── A5. Health ───────
  health: adminProcedure.query(({ ctx }) => {
    if (!ctx.lineAdmin) {
      return {
        todayCount: 0,
        errorCount: 0,
        errorRate: 0,
        uptimeS: Math.floor(process.uptime()),
        openaiTokensToday: 0,
        avgLatencyMs: 0,
      };
    }
    const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
    const todayCount = (ctx.lineAdmin.db.prepare(
      `SELECT COUNT(*) AS n FROM line_message_log WHERE created_at >= ?`
    ).get(today) as { n: number }).n;
    const errorCount = (ctx.lineAdmin.db.prepare(
      `SELECT COUNT(*) AS n FROM line_message_log
       WHERE direction = 'outbound' AND created_at >= ? AND content LIKE '%系統忙碌%'`
    ).get(today) as { n: number }).n;
    return {
      todayCount,
      errorCount,
      errorRate: todayCount > 0 ? errorCount / todayCount : 0,
      uptimeS: Math.floor(process.uptime()),
      // OpenAI tokens / latency would require additional log columns; placeholder for v2
      openaiTokensToday: 0,
      avgLatencyMs: 0,
    };
  }),

  // ─────── A6. Manual push ───────
  manualPush: adminLineProcedure.input(z.object({
    lineUserId: z.string().regex(/^U[0-9a-fA-F]{32}$/),
    text:       z.string().min(1).max(500),
  })).mutation(async ({ ctx, input }) => {
    await ctx.lineAdmin.lineClient.push(input.lineUserId, { type: 'text', text: input.text });
    ctx.lineAdmin.messageLog.write({
      lineUserId: input.lineUserId,
      direction: 'outbound:debug',
      messageType: 'text',
      content: input.text,
    });
    return { ok: true as const };
  }),
});

// ─────── Per-key value validation ───────
type ValidationResult = { ok: true; value: unknown } | { ok: false; error: string };

function validateConfigValue(key: string, value: unknown): ValidationResult {
  switch (key) {
    case 'line.rateLimit.perMinute':
      if (typeof value !== 'number' || value < 1 || value > 1000)
        return { ok: false, error: 'must be a number between 1 and 1000' };
      return { ok: true, value };
    case 'line.rateLimit.perDay':
      if (typeof value !== 'number' || value < 1 || value > 100_000)
        return { ok: false, error: 'must be a number between 1 and 100000' };
      return { ok: true, value };
    case 'ai.openai.model':
      // Accepts OpenAI (gpt-*) and Gemini (gemini-*) model names. Note: this row
      // is display-only — the live classifier reads OPENAI_MODEL env, not this.
      if (typeof value !== 'string' || !/^(gpt|gemini)[\w.-]+$/.test(value))
        return { ok: false, error: 'must be a string matching gpt-* or gemini-* pattern' };
      return { ok: true, value };
    case 'ai.openai.temperature':
      if (typeof value !== 'number' || value < 0 || value > 2)
        return { ok: false, error: 'must be a number between 0 and 2' };
      return { ok: true, value };
    case 'ai.confidenceThreshold':
      if (typeof value !== 'number' || value < 0 || value > 1)
        return { ok: false, error: 'must be a number between 0 and 1' };
      return { ok: true, value };
    case 'demo.bannerEnabled':
      if (typeof value !== 'boolean')
        return { ok: false, error: 'must be a boolean' };
      return { ok: true, value };
    case 'demo.adminLineUserIds':
      if (!Array.isArray(value) || !value.every(v => typeof v === 'string' && /^U[0-9a-fA-F]{32}$/.test(v)))
        return { ok: false, error: 'must be an array of LINE userId strings (U + 32 hex)' };
      return { ok: true, value };
    default:
      return { ok: false, error: `unknown config key: ${key}` };
  }
}
