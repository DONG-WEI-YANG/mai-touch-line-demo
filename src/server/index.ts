import 'dotenv/config';
import { createServer } from 'http';
import net from 'net';
import { createApp } from './app';
import * as db from './db';
import { startAuditCleanupScheduler } from './audit-cleanup-scheduler';
import { setDispatchDeps } from './line/dispatcher';
import { LineClient } from './line/line-client';
import { sessionStore } from './line/session-store';
import { makeLineUserRepo } from './line/line-user-repo';
import { makeMessageLog } from './line/message-log';
import { makePushHousekeepers } from './line/push-housekeepers';
import { getAi } from './_core/profile';
import { dbManager } from './database/adapter';

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
  await db.seedSystemIfEmpty();
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
      const lineUserRepo = makeLineUserRepo(rawSqlite);
      const lineClient = new LineClient({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
        channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
      });
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

      // Real bookFn — calls db.createBooking directly (skip tRPC ctx auth for demo)
      const bookFn = async (input: { facility: string; date: string; time: string }): Promise<{ id: string }> => {
        const amenityId = facilityToAmenityId.get(input.facility);
        if (!amenityId) {
          console.warn('[LINE] no amenity mapped for facility', input.facility, '— using fallback id=1');
        }
        // Derive endTime = startTime + 1 hour
        const [h, m] = input.time.split(':').map(Number);
        const endH = (h + 1) % 24;
        const endTime = `${String(endH).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
        const bookingId = await db.createBooking({
          userId: SEED_USER_ID,
          amenityId: amenityId ?? 1,
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

      // updateOrder: maps BK-<id> → bookings table status update
      // LINE statuses map to booking status enum: confirmed|pending|cancelled|completed
      const updateOrder = async (orderId: string, patch: {
        status: 'open'|'in_progress'|'resolved'|'closed';
        acceptedBy?: string;
        rejectedBy?: string;
      }): Promise<void> => {
        if (!orderId.startsWith('BK-')) {
          console.warn('[LINE] unknown orderId format', orderId);
          return;
        }
        const numId = Number(orderId.slice(3));
        if (!Number.isFinite(numId)) return;
        // Map LINE work-order statuses to bookings.status enum.
        // LineStatus mirrors the 'status' union in the updateOrder patch parameter above.
        // DbBookingStatus mirrors updateBookingStatus()'s inline parameter type in db.ts
        // (consider exporting a named BookingStatus type from db.ts for reuse).
        type LineStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
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
      };

      setDispatchDeps({
        lineClient,
        ai: getAi(),
        store: sessionStore,
        lineUserRepo,
        messageLog: makeMessageLog(rawSqlite),
        channelId,
        bookFn,
        pushHousekeepers,
        updateOrder,
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
