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
      // repos would need a different approach (Phase 5 concern).
      const rawSqlite = dbManager.getRawSqlite();
      setDispatchDeps({
        lineClient: new LineClient({
          channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
          channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
        }),
        ai: getAi(),
        store: sessionStore,
        lineUserRepo: makeLineUserRepo(rawSqlite),
        messageLog: makeMessageLog(rawSqlite),
        channelId: process.env.LINE_CHANNEL_ID ?? 'default',
        bookFn: async (input) => {
          // TODO Phase 5+: replace with real booking via appRouter.createCaller(ctx).amenities.book(input)
          const id = 'WO-' + Date.now().toString(36).toUpperCase();
          console.warn('[LINE] STUB bookFn called', { input, id });
          return { id };
        },
        pushHousekeepers: async (payload) => {
          // TODO Phase 5: implement real push to all housekeepers via lineUserRepo.listByRole + lineClient.push
          console.warn('[LINE] STUB pushHousekeepers', payload);
        },
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
