import 'dotenv/config';
import crypto from 'crypto';
import { createServer } from 'http';
import net from 'net';
import { createApp } from './app';
import * as db from './db';
import { startAuditCleanupScheduler } from './audit-cleanup-scheduler';
import { setDispatchDeps } from './line/dispatcher';
import { LineClient } from './line/line-client';
import { sessionStore, SqliteSessionBackend } from './line/session-store';
import { makeLineUserRepo } from './line/line-user-repo';
import { makeMessageLog } from './line/message-log';
import { setLineAdminContext } from './_core/context';
import { makePushHousekeepers } from './line/push-housekeepers';
import { getAi } from './_core/profile';
import { dbManager } from './database/adapter';
import { runMigrations } from './database/migrate';
import { makeRateLimiter } from './line/rate-limit';
import { makeEventDedupe } from './line/event-dedupe';
import { makeRuntimeConfig } from './line/runtime-config';
import { handleCommand } from './line/handlers/command';
import { startDemo, stopDemo } from './line/handlers/demo';
import { listScripts } from './line/demo-scripts';

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on('error', () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Apply any pending schema migrations at boot. Without this, migrations on disk
  // only ever ran via the `db:init*` scripts, so any DB created/migrated earlier
  // drifted out of sync (recorded versions lagged the files; missing tables were
  // papered over by per-repo self-heal). Every migration is CREATE TABLE/INDEX
  // IF NOT EXISTS, so this is idempotent. Tolerate failure — a bad migration must
  // not block boot, but it should be loud.
  try {
    await runMigrations();
  } catch (err) {
    console.warn('[Server] runMigrations failed (continuing on existing schema):', (err as Error).message);
  }

  // seedSystemIfEmpty uses now() SQL function which is MySQL-specific and crashes on
  // SQLite. In demo profile we already seeded via `npm run db:init:demo` at build time,
  // so it's safe to skip. In prod we still call it but tolerate failure (don't block boot).
  try {
    await db.seedSystemIfEmpty();
  } catch (err) {
    console.warn('[Server] seedSystemIfEmpty failed (continuing — may be SQLite vs MySQL syntax):', (err as Error).message);
  }
  startAuditCleanupScheduler();

  // ──── LINE dispatcher setup (only when LINE env vars present) ────────────────
  // Must run BEFORE createApp() so getDispatchDeps() is available when the
  // webhook route is hit. Requires the db to be connected (done above via
  // seedSystemIfEmpty → getDb → dbManager.connect).
  if (process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    try {
      // dbManager.connect() was already called transitively via seedSystemIfEmpty/getDb.
      // getRawSqlite() is only valid for SQLite adapters; for MySQL/Postgres the LINE
      // repos would need a different approach (Phase 7 concern).
      const rawSqlite = dbManager.getRawSqlite();

      // ── Runtime config — must load BEFORE any dep that reads from it ──────
      const runtimeConfig = makeRuntimeConfig(rawSqlite);
      await runtimeConfig.load();

      // ── Persist LINE session state across restarts ───────────────────────
      // Replace the default in-memory Map with a SQLite-backed store so that
      // mid-conversation slot-filling survives a Render redeploy. Requires
      // migration 0010_line_sessions to have run; tolerate failure (fall
      // back to in-memory) so a missing migration doesn't crash boot.
      try {
        sessionStore.setBackend(new SqliteSessionBackend(rawSqlite));
      } catch (err) {
        console.warn('[LINE] SqliteSessionBackend unavailable, using in-memory:', (err as Error).message);
      }

      const lineUserRepo = makeLineUserRepo(rawSqlite);
      const lineClient = new LineClient({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
        channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
        // Evaluated per message-send so dashboard changes take effect without restart
        demoBanner: () =>
          process.env.DEPLOY_PROFILE === 'demo' &&
          runtimeConfig.get<boolean>('demo.bannerEnabled', process.env.DEMO_BANNER !== 'false'),
      });

      // ── Rate limiter & event dedupe (boot-time singletons) ────────────────
      // getLimits() is called per-check so dashboard changes take effect without restart
      const rateLimiter = makeRateLimiter({
        getLimits: () => ({
          perMinute: runtimeConfig.get<number>('line.rateLimit.perMinute',
            Number(process.env.LINE_RATE_LIMIT_PER_MIN ?? '10')),
          perDay: runtimeConfig.get<number>('line.rateLimit.perDay',
            Number(process.env.LINE_RATE_LIMIT_PER_DAY ?? '200')),
        }),
      });
      const eventDedupe = makeEventDedupe(1000);
      const channelId = process.env.LINE_CHANNEL_ID ?? 'default';

      // Build facility-name → amenityId map at boot (run AFTER seedSystemIfEmpty)
      const amenities = await db.getAllAmenities();
      const facilityToAmenityId = new Map<string, number>();
      for (const a of amenities) {
        const n = (a.name ?? '').toLowerCase();
        // Fuzzy match: last-write-wins per facility key. Safe for current demo seed data
        // (one amenity per facility type). If multi-amenity-per-type is added later, replace
        // with explicit name → facility key map.
        for (const k of ['gym', 'pool', 'meeting_room', 'meeting', 'lounge', 'bbq', 'sauna']) {
          if (n.includes(k)) facilityToAmenityId.set(k, a.id);
        }
      }
      // 'meeting_room' token: also match plain 'meeting' key so both map correctly
      if (facilityToAmenityId.has('meeting') && !facilityToAmenityId.has('meeting_room')) {
        facilityToAmenityId.set('meeting_room', facilityToAmenityId.get('meeting')!);
      }
      console.log('[LINE] facility map:', Object.fromEntries(facilityToAmenityId));

      const SEED_USER_ID = 1;

      // ── Per-LINE-user web account binding ────────────────────────────────────
      // On `follow` (or first interaction), provision a `users` row + a personal
      // web token for the LINE friend, store it in web_tokens, and link the
      // line_user.app_user_id. Returns the personalized portal URL the bot can
      // DM back so the resident can open their own dashboard.
      const insertUserStmt = rawSqlite.prepare(`
        INSERT INTO users (openId, name, email, loginMethod, role, tier, unitId)
        VALUES (?, ?, ?, 'line', 'resident', 'Platinum', 1)
      `);
      const insertWebTokenStmt = rawSqlite.prepare(
        `INSERT INTO web_tokens (token, user_id) VALUES (?, ?)`
      );
      const setLineAppUserStmt = rawSqlite.prepare(
        `UPDATE line_user SET app_user_id = ? WHERE channel_id = ? AND line_user_id = ?`
      );
      const tokenForUserStmt = rawSqlite.prepare(
        `SELECT token FROM web_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
      );
      const webBaseUrl = process.env.WEB_BASE_URL ?? 'https://mai-touch-web.vercel.app';

      const bindWebUser = (lineUserId: string, displayName?: string | null): { url: string; isNew: boolean } => {
        let row = lineUserRepo.byLineId(channelId, lineUserId);
        if (!row) {
          lineUserRepo.upsert({ channelId, lineUserId, displayName: displayName ?? null });
          row = lineUserRepo.byLineId(channelId, lineUserId)!;
        }
        // Already bound — reuse existing token (prevents accidental token rotation)
        if (row.appUserId) {
          const existing = tokenForUserStmt.get(row.appUserId) as { token: string } | undefined;
          if (existing) return { url: `${webBaseUrl}/?token=${existing.token}`, isNew: false };
        }
        // Provision: new users row + token, link line_user
        const openId = `line-${lineUserId}`;
        const userInsert = insertUserStmt.run(
          openId, displayName ?? 'LINE Resident', `${openId}@line.local`,
        );
        const newUserId = Number(userInsert.lastInsertRowid);
        const token = crypto.randomBytes(16).toString('hex');
        insertWebTokenStmt.run(token, newUserId);
        setLineAppUserStmt.run(newUserId, channelId, lineUserId);
        return { url: `${webBaseUrl}/?token=${token}`, isNew: true };
      };

      // Resolve LINE user id → app_user_id for write paths. Falls back to the
      // shared SEED_USER_ID when the LINE user hasn't been bound yet (e.g. a
      // legacy session before this feature shipped).
      const resolveAppUserId = (lineUserId: string | undefined): number => {
        if (!lineUserId) return SEED_USER_ID;
        const row = lineUserRepo.byLineId(channelId, lineUserId);
        return row?.appUserId ?? SEED_USER_ID;
      };

      // Push a text message to a specific LINE user via lineUserId. Used by the
      // status-change push-back so when logistics moves a work order, the
      // original requester gets a notification on their LINE.
      const pushToLineUser = async (lineUserId: string, message: string): Promise<void> => {
        try {
          await lineClient.replyOrPush(undefined, lineUserId, { type: 'text', text: message });
        } catch (err) {
          console.error('[LINE] push to user failed', { lineUserId, err });
        }
      };

      // Real bookFn — calls db.createBooking directly (skip tRPC ctx auth for demo)
      const bookFn = async (input: { facility: string; date: string; time: string }, lineUserId?: string): Promise<{ id: string }> => {
        const amenityId = facilityToAmenityId.get(input.facility);
        // Audit finding: don't silently book amenity #1 when the facility isn't
        // mapped — that told the user their sauna/pool booking succeeded while a
        // booking against a different room was created. Fail loudly instead; the
        // caller (resident handler) shows a "busy, try again" reply on throw.
        if (!amenityId) {
          console.error('[LINE] no amenity mapped for facility', input.facility);
          throw new Error(`Unknown facility "${input.facility}" — no matching amenity`);
        }
        // Derive endTime = startTime + 1 hour
        const [h, m] = input.time.split(':').map(Number);
        const endH = (h + 1) % 24;
        const endTime = `${String(endH).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
        const bookingId = await db.createBooking({
          userId: resolveAppUserId(lineUserId),
          amenityId,
          date: input.date,
          startTime: input.time,
          endTime,
          guestCount: 1,
          notes: `[LINE demo] facility=${input.facility}`,
        });
        return { id: `BK-${bookingId}` };
      };

      // Real pushHousekeepers — fan-out to all housekeepers in the channel
      const pushHousekeepers = makePushHousekeepers({ lineUserRepo, client: lineClient, channelId });

      // updateOrder: housekeeper accept/reject from LINE → write the shared 單號
      // back to the right table, then push the status change to the original
      // LINE requester so the loop (resident ⇄ housekeeper ⇄ logistics) closes.
      //   BK-<id>            → bookings table (status enum: confirmed|pending|cancelled|completed)
      //   WO-/V-/C-<id>      → work_orders table (status enum is the LineStatus union 1:1)
      type LineStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
      const STATUS_ZH: Record<LineStatus, string> = {
        open: '已建立', in_progress: '處理中', resolved: '已完成', closed: '已關閉',
      };
      // Friendly label for a housekeeper LINE userId — prefers their display name,
      // falls back to "管家 <short-id>" so the logistics/admin dashboard never shows a raw LINE U-hash.
      const friendlyHousekeeperLabel = (lineUserId: string): string => {
        const hk = lineUserRepo.byLineId(channelId, lineUserId);
        const name = hk?.displayName?.trim();
        if (name) return name;
        return `管家 ${lineUserId.slice(1, 7)}`;
      };
      // Notify the LINE user who originally filed work order app_user_id=`appUserId` (if any) — best-effort.
      // Includes the assignee name in the message when a housekeeper just accepted.
      const pushStatusBackToRequester = async (appUserId: number, orderRef: string, title: string, status: LineStatus, assigneeName?: string): Promise<void> => {
        try {
          const row = rawSqlite.prepare(
            `SELECT line_user_id FROM line_user WHERE app_user_id = ? AND channel_id = ? LIMIT 1`
          ).get(appUserId, channelId) as { line_user_id: string } | undefined;
          if (row?.line_user_id) {
            const suffix = assigneeName ? `(處理人:${assigneeName})` : '';
            await pushToLineUser(row.line_user_id, `工單 #${orderRef}「${title}」狀態更新:${STATUS_ZH[status]}${suffix}`);
          }
        } catch (err) {
          console.error('[LINE] status push-back to requester failed', { orderRef, appUserId, err });
        }
      };
      const WORK_ORDER_REF = /^(?:WO|V|C)-(\d+)$/;
      const updateOrder = async (orderId: string, patch: {
        status: LineStatus;
        acceptedBy?: string;
        rejectedBy?: string;
      }): Promise<void> => {
        // ── Facility booking ─────────────────────────────────────────────────
        if (orderId.startsWith('BK-')) {
          const numId = Number(orderId.slice(3));
          if (!Number.isFinite(numId)) return;
          // DbBookingStatus mirrors updateBookingStatus()'s inline parameter type in db.ts.
          type DbBookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';
          const dbStatusMap: Record<LineStatus, DbBookingStatus> = {
            open:        'pending',    // re-queued → pending
            in_progress: 'confirmed',  // housekeeper accepted → booking confirmed
            resolved:    'completed',  // completed
            closed:      'cancelled',  // housekeeper rejected → booking cancelled
          };
          const dbStatus = dbStatusMap[patch.status];
          await db.updateBookingStatus(numId, dbStatus);
          console.log('[LINE] booking status updated', { id: numId, lineStatus: patch.status, dbStatus, by: patch.acceptedBy ?? patch.rejectedBy });
          return;
        }

        // ── Work order (repair / visitor / complaint) ────────────────────────
        const woMatch = orderId.match(WORK_ORDER_REF);
        if (woMatch) {
          const numId = Number(woMatch[1]);
          const before = await db.getWorkOrderById(numId);
          // When a housekeeper accepts, stamp `assignedTo` with their friendly name
          // so logistics/admin dashboards (and `WO_STATUS_LABEL` consumers) can show
          // "誰在處理"; on reject we leave assignedTo alone (it's a cancellation).
          const assigneeName = patch.acceptedBy ? friendlyHousekeeperLabel(patch.acceptedBy) : undefined;
          // work_orders.status enum === LineStatus union — no mapping needed.
          await db.updateWorkOrder(numId, {
            status: patch.status,
            ...(assigneeName ? { assignedTo: assigneeName } : {}),
          });
          console.log('[LINE] work order status updated', { id: numId, status: patch.status, assignedTo: assigneeName, by: patch.acceptedBy ?? patch.rejectedBy });
          if (before) await pushStatusBackToRequester(before.userId, orderId, String(before.title ?? ''), patch.status, assigneeName);
          return;
        }

        console.warn('[LINE] unknown orderId format', orderId);
      };

      // Generic work-order writer for non-facility intents (repair/visitor/complaint).
      // Returns the new order id for echo-back to the user.
      type WoCategory = 'maintenance' | 'security' | 'concierge' | 'housekeeping' | 'laundry' | 'vehicle' | 'other';
      const inferCategory = (intentShort: string, blob: string): WoCategory => {
        // Keyword sniff first — overrides intent for housekeeping/laundry/vehicle
        // since LINE NLP often classifies these as 'complaint' or 'concierge'.
        const t = blob.toLowerCase();
        if (/送洗|乾洗|洗衣|laundry/.test(t))                                            return 'laundry';
        if (/打掃|清潔|housekeeping|cleaning/.test(t))                                   return 'housekeeping';
        if (/接送|機場|車輛|代駕|外出|airport|pickup|drop[- ]?off/.test(t))               return 'vehicle';
        if (intentShort === 'repair')                                                    return 'maintenance';
        if (intentShort === 'visitor')                                                   return 'concierge';
        if (intentShort === 'complaint')                                                 return 'other';
        return 'other';
      };
      const reportFn = async (input: { intent: string; slots: Record<string, unknown> }, lineUserId?: string): Promise<{ id: string }> => {
        const s: any = input.slots ?? {};
        const urgency = String(s.urgency ?? 'med');
        const priority: 'low' | 'medium' | 'high' | 'urgent' =
          urgency === 'high' ? 'high' : urgency === 'med' ? 'medium' : 'low';
        const intentShort = input.intent.split('.')[0];
        const summaryParts = [
          s.issue, s.location, s.visitor_name && `visitor=${s.visitor_name}`,
          s.visitor_count && `count=${s.visitor_count}`, s.date, s.time,
        ].filter(Boolean);
        const blob = `${input.intent} ${summaryParts.join(' ')} ${JSON.stringify(s)}`;
        const category = inferCategory(intentShort, blob);
        const orderId = await db.createWorkOrder({
          userId: resolveAppUserId(lineUserId),
          title: `[${intentShort}] ${summaryParts[0] ?? 'demo'}`,
          description: JSON.stringify(s),
          category,
          priority,
        });
        const prefix = intentShort === 'repair' ? 'WO' : intentShort === 'visitor' ? 'V' : 'C';
        return { id: `${prefix}-${orderId}` };
      };

      // workorder.status intent → the resident's work orders + facility bookings.
      const amenityNameById = new Map<number, string>(
        [...facilityToAmenityId.entries()].map(([name, id]) => [id, name]),
      );
      const WO_CAT_LABEL: Record<string, string> = {
        maintenance: '報修', security: '保全', concierge: '禮賓',
        housekeeping: '清潔', laundry: '送洗', vehicle: '車輛', other: '其他',
      };
      const WO_STATUS_LABEL: Record<string, string> = {
        open: '待處理', in_progress: '處理中', resolved: '已完成', closed: '已關閉',
      };
      const BK_STATUS_LABEL: Record<string, string> = {
        confirmed: '已確認', pending: '待確認', cancelled: '已取消', completed: '已完成',
      };
      const listMyOrders = async (lineUserId: string) => {
        const uid = resolveAppUserId(lineUserId);
        const [wos, bks] = await Promise.all([db.getUserWorkOrders(uid), db.getUserBookings(uid)]);
        const woItems = wos.map((w: any) => ({
          ref: `WO-${w.id}`,
          label: WO_CAT_LABEL[w.category] ?? '工單',
          detail: String(w.title ?? '').slice(0, 40),
          status: WO_STATUS_LABEL[w.status] ?? String(w.status),
        }));
        const bkItems = bks.map((b: any) => ({
          ref: `BK-${b.id}`,
          label: '設施預約',
          detail: `${amenityNameById.get(b.amenityId) ?? `#${b.amenityId}`} ${b.date} ${b.startTime}`,
          status: BK_STATUS_LABEL[b.status] ?? String(b.status),
        }));
        return [...woItems, ...bkItems];
      };

      // Demo side-effect dispatcher — resolves (router, procedure) → direct db call
      // Avoids tRPC ctx complexity; mirrors the bookFn / updateOrder pattern above.
      const runSideEffect = async (call: { router: string; procedure: string; input: any }): Promise<void> => {
        console.log('[LINE/DEMO] side effect', call);
        try {
          if (call.router === 'amenities' && call.procedure === 'book') {
            const { facility, date, time, userId: uid } = call.input;
            const amenityId = facilityToAmenityId.get(facility) ?? 1;
            const [h, m] = String(time).split(':').map(Number);
            const endH = (h + 1) % 24;
            await db.createBooking({
              userId: uid ?? SEED_USER_ID,
              amenityId,
              date,
              startTime: time,
              endTime: `${String(endH).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`,
              guestCount: 1,
              notes: '[demo script] facility book',
            });
          } else if (call.router === 'workOrders' && call.procedure === 'create') {
            const { type, issue, location, urgency, userId: uid } = call.input;
            const priority: 'low' | 'medium' | 'high' | 'urgent' =
              urgency === 'high' ? 'high' : urgency === 'med' ? 'medium' : 'low';
            await db.createWorkOrder({
              userId: uid ?? SEED_USER_ID,
              title: `[${type}] ${issue ?? location ?? 'demo'}`,
              description: JSON.stringify(call.input),
              priority,
            });
          } else {
            console.warn('[LINE/DEMO] unhandled side_effect router/procedure', call);
          }
        } catch (err) {
          console.error('[LINE/DEMO] side_effect db call failed', { call, err });
          // Don't rethrow — let demo continue (the script's next bot_say will still play)
        }
      };

      // ── Command handler factory ──────────────────────────────────────────
      // demoDepsFactory is called per-event with the current lineUser so startDemo/stopDemo
      // get the correct userId + language without closure-scope leakage across events.
      // Note: this is a lightweight object literal per call (no heap accumulation concern).
      // Per-script enabled check honoring demo_script_config.enabled (set via dashboard /admin/line/scripts).
      // Synchronous prepared statement — fast enough for per-/demo-trigger check.
      const isScriptEnabledStmt = rawSqlite.prepare(`SELECT enabled FROM demo_script_config WHERE id = ?`);
      const isScriptEnabled = (id: string): boolean => {
        const row = isScriptEnabledStmt.get(id) as { enabled: number } | undefined;
        return row ? !!row.enabled : true;  // default to enabled if no config row
      };

      const demoDepsFactory = (lineUser: { lineUserId: string; language: import('./line/ai/types').Lang }) => ({
        store: sessionStore,
        client: lineClient,
        lineUser,
        runSideEffect,
        isScriptEnabled,
      });

      const commandHandler = async (
        text: string,
        ev: any,
        lineUser: { lineUserId: string; role: 'resident' | 'housekeeper' | 'admin'; language: import('./line/ai/types').Lang },
      ): Promise<boolean> => {
        // Read per-event so dashboard changes to demo.adminLineUserIds apply without restart.
        // MERGE env + DB so env can bootstrap admins even when DB seed is empty array []
        // (which is truthy and would otherwise block the env fallback in `v ?? fallback`).
        const dbList = runtimeConfig.get<string[]>('demo.adminLineUserIds', []);
        const envList = (process.env.DEMO_ADMIN_LINE_USERS ?? '')
          .split(',').map(s => s.trim()).filter(Boolean);
        const adminWhitelist = Array.from(new Set([...dbList, ...envList]));
        return handleCommand(text, ev, {
          client: lineClient,
          lineUserRepo,
          channelId,
          lineUser,
          sessionStore,
          adminWhitelist,
          startDemo: (id: string) => startDemo(id, demoDepsFactory(lineUser)),
          stopDemo: () => stopDemo(demoDepsFactory(lineUser)),
          listScripts,
        });
      };

      const messageLog = makeMessageLog(rawSqlite);

      setDispatchDeps({
        lineClient,
        ai: getAi(),
        store: sessionStore,
        lineUserRepo,
        messageLog,
        channelId,
        bookFn,
        reportFn,
        pushHousekeepers,
        listMyOrders,
        updateOrder,
        runSideEffect,
        commandHandler,
        rateLimiter,
        eventDedupe,
        bindWebUser,
        pushToLineUser,
      });

      // ── Admin dashboard context — must be set BEFORE createApp() ─────────
      setLineAdminContext({
        db: rawSqlite,
        runtimeConfig,
        lineUserRepo,
        messageLog,
        lineClient,
        channelId,
        sessionStore,
        runSideEffect,
        pushToLineUser,
      });

      console.log('[LINE] dispatcher configured');
    } catch (err) {
      console.error('[LINE] dispatcher setup failed (non-fatal, webhook will throw on first request):', err);
    }
  }

  const app = createApp();
  const server = createServer(app);

  const preferredPort = parseInt(process.env.PORT || '3000');
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
