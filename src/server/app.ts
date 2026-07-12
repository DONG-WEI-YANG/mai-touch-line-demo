import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { registerOAuthRoutes } from './oauth';
import { appRouter } from './routers/index';
import { adminRouter } from './admin';
import { createContext } from './_core/context';
import {
  authLimiter, voiceLimiter, chatLimiter, adminLimiter, trustedIPRateLimit
} from './middleware/rateLimit';
import { smartCacheMiddleware } from './middleware/cache';
import { getProfile } from './_core/profile';
import { mountWebhook } from './line/webhook';
import { dispatch, getDispatchDeps, isDispatcherConfigured } from './line/dispatcher';
import { mountAdminDashboard } from './line/admin-dashboard';
import * as db from './db';
import { hardwareGatewayService } from './services/hardwareGatewayService';
import { handleSmartHomeRequest } from './services/googleSmartHome';
import { logError } from './_core/logError';
import { ErrorIds } from './constants/errorIds';

export function createApp(): express.Express {
  const app = express();

  // CORS — same logic as before
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : [
        'http://localhost:8081',
        'http://127.0.0.1:8081',
        'http://localhost:8082',
        'http://127.0.0.1:8082',
        'http://localhost:8083',
        'http://127.0.0.1:8083',
        'http://localhost:19006',
        'http://127.0.0.1:19006',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];

  // GitHub Pages frontend origin — always allowed regardless of CORS_ORIGINS env
  // so the Pages build (dong-wei-yang.github.io/mai-touch-line-demo/) can call the
  // API without also having to touch the Render env. See the deploy-pages workflow.
  const alwaysAllowedOrigins = ['https://dong-wei-yang.github.io'];

  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || alwaysAllowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  }));

  app.use(cookieParser());

  // Mount LINE webhook BEFORE the global express.json() — webhook needs raw body for HMAC verify
  if (process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    mountWebhook(app, { dispatch: (events) => dispatch(events, getDispatchDeps()) });
    console.log('[LINE] webhook mounted at /line/webhook');
  } else {
    console.log('[LINE] webhook not mounted (missing LINE_CHANNEL_*)');
  }

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use('/api/auth/*', authLimiter);
  app.use('/api/voice/*', voiceLimiter);
  app.use('/api/chat/*', chatLimiter);
  app.use('/api/admin/*', adminLimiter);
  app.use('/api/*', trustedIPRateLimit);
  app.use('/api/*', smartCacheMiddleware());

  // Existing health (DO NOT remove)
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // NEW health for Render + cron-job.org
  app.get('/health', (_req, res) => {
    // Report LINE readiness honestly (audit finding H5): if the LINE env is
    // configured but the dispatcher boot wiring failed, the bot is dead — surface
    // it as "degraded" instead of a green light. "disabled" = LINE intentionally off.
    const lineConfigured = !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
    const line = !lineConfigured ? 'disabled' : isDispatcherConfigured() ? 'ready' : 'degraded';
    res.json({
      ok: true,
      profile: getProfile(),
      db: 'ok',
      line,
      ai_provider: getProfile() === 'demo' ? 'openai' : 'nlp-service',
      uptime_s: Math.floor(process.uptime()),
    });
  });

  // Root landing page — service status + endpoint inventory.
  // This service is backend-only; frontend (Expo Router web) lives in src/app/ and
  // is built/deployed separately. The root page exists so visitors who navigate to
  // the bare URL see a useful status page instead of 'Cannot GET /'.
  app.get('/', (_req, res) => {
    const profile = getProfile();
    const lineMounted = !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
    const uptimeS = Math.floor(process.uptime());
    const uptimeStr = uptimeS < 60 ? `${uptimeS}s` :
                      uptimeS < 3600 ? `${Math.floor(uptimeS / 60)}m ${uptimeS % 60}s` :
                      `${Math.floor(uptimeS / 3600)}h ${Math.floor((uptimeS % 3600) / 60)}m`;
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>m'AI Touch — LINE Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
           background: #1a1a1a; color: #eee; margin: 0; padding: 32px; line-height: 1.5; }
    .wrap { max-width: 720px; margin: 0 auto; }
    h1 { color: #C9A96E; font-size: 24px; margin: 0 0 4px; }
    .subtitle { color: #999; font-size: 14px; margin-bottom: 24px; }
    .card { background: #252525; border-radius: 6px; padding: 16px; margin-bottom: 12px; }
    .card h2 { color: #C9A96E; font-size: 14px; margin: 0 0 8px; text-transform: uppercase;
               letter-spacing: 0.05em; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; }
    .row .k { color: #888; }
    .row .v { color: #fff; font-family: ui-monospace, "SF Mono", monospace; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px;
             font-weight: 600; }
    .ok    { background: #0a5d0a; color: #fff; }
    .off   { background: #5d0a0a; color: #fff; }
    .demo  { background: #C9A96E; color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #333; font-size: 13px; }
    th { color: #888; font-weight: 500; font-size: 11px; text-transform: uppercase; }
    code { background: #111; padding: 1px 5px; border-radius: 3px; font-size: 12px; color: #C9A96E; }
    a { color: #C9A96E; }
    .footer { color: #666; font-size: 11px; margin-top: 32px; text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>m'AI Touch — LINE Demo</h1>
    <div class="subtitle">Backend service for the AI housekeeper LINE bot. This is not a user-facing page — interact via LINE.</div>

    <div class="card">
      <h2>Service Status</h2>
      <div class="row"><span class="k">Status</span><span class="v"><span class="badge ok">live</span></span></div>
      <div class="row"><span class="k">Profile</span><span class="v"><span class="badge ${profile === 'demo' ? 'demo' : 'ok'}">${profile}</span></span></div>
      <div class="row"><span class="k">AI provider</span><span class="v">${profile === 'demo' ? 'OpenAI gpt-4o-mini' : 'NLP service (FastAPI)'}</span></div>
      <div class="row"><span class="k">LINE webhook</span><span class="v"><span class="badge ${lineMounted ? 'ok' : 'off'}">${lineMounted ? 'mounted' : 'not configured'}</span></span></div>
      <div class="row"><span class="k">Uptime</span><span class="v">${uptimeStr}</span></div>
    </div>

    <div class="card">
      <h2>Endpoints</h2>
      <table>
        <tr><th>Path</th><th>Method</th><th>Purpose</th></tr>
        <tr><td><a href="/health">/health</a></td><td>GET</td><td>Render healthcheck + cron ping</td></tr>
        <tr><td><a href="/api/health">/api/health</a></td><td>GET</td><td>Legacy timestamp ping</td></tr>
        <tr><td><code>/line/webhook</code></td><td>POST</td><td>LINE Messaging API webhook (HMAC-verified)</td></tr>
        <tr><td><code>/api/trpc/*</code></td><td>POST</td><td>tRPC procedures (incl. lineAdmin dashboard)</td></tr>
        <tr><td><code>/admin/*</code></td><td>various</td><td>Existing admin API</td></tr>
        <tr><td><code>/api/auth/*</code></td><td>various</td><td>OAuth callbacks</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>How to Use</h2>
      <div style="font-size:13px; color:#ccc;">
        <p style="margin:0 0 8px;">1. On LINE app, add the bot as friend (QR from LINE Developer Console)</p>
        <p style="margin:0 0 8px;">2. Send <code>/help</code> to see commands</p>
        <p style="margin:0 0 8px;">3. Send <code>/demo facility</code> for an automated walkthrough</p>
        <p style="margin:0;">4. Send free text like "我想預約週六晚上 7 點的健身房"</p>
      </div>
    </div>

    <div class="footer">
      Spec &amp; setup guide: <code>docs/LINE_INTEGRATION.md</code> in the repo
    </div>
  </div>
</body>
</html>`);
  });

  // Google Smart Home (Cloud-to-Cloud) fulfillment webhook. This is the ONLY
  // supported Google-speaker → backend path, and it is DEVICE CONTROL only
  // (開燈/開冷氣) — not voice booking. Google POSTs SYNC/QUERY/EXECUTE here with
  // the account-linked user in the Bearer token; createContext resolves it the
  // same way tRPC does. External setup (Actions Console + OAuth linking) is the
  // operator's — see docs/security/google-smart-home.md.
  app.post('/google/smarthome', async (req, res) => {
    try {
      const ctx = await createContext({ req, res });
      const user = ctx.user as any;
      if (!user) return res.status(401).json({ error: 'unauthorized' });
      const result = await handleSmartHomeRequest(req.body, user.id, {
        listDevices: async () => (user.unitId ? (await db.getDevicesByUnit(user.unitId)) as any : []),
        getDevice: (id) => db.getDeviceById(id) as any,
        setDeviceStatus: async (id, status) => {
          // Dispatch to hardware FIRST; only persist after it succeeds (audit
          // findings C3 + H1). A genuine gateway failure returns success:false
          // (strict mode / hard error) — throw so handleExecute reports a
          // truthful ERROR to Google instead of a false SUCCESS. A safe fallback
          // (no gateway configured / demo) returns success:true and still
          // persists, so the demo reflects intent.
          const dev: any = await db.getDeviceById(id);
          const result = await hardwareGatewayService.dispatchDeviceCommand({
            deviceId: id,
            status,
            requestedBy: `google:${user.id}`,
            deviceName: dev?.name,
            deviceType: dev?.type,
            unitId: dev?.unitId ?? null,
            amenityId: dev?.amenityId ?? null,
          });
          if (!result.success) {
            throw new Error(`Hardware command rejected: ${result.reason ?? "unknown"}`);
          }
          await db.updateDeviceStatus(id, status);
        },
      });
      res.json(result);
    } catch (err) {
      logError(ErrorIds.GOOGLE_FULFILLMENT_ERROR, 'Google Smart Home fulfillment failed', { cause: err });
      res.status(500).json({ error: 'fulfillment_error' });
    }
  });

  registerOAuthRoutes(app);
  // Mount LINE admin dashboard BEFORE the existing adminRouter so /admin/line/*
  // routes match here first, while other /admin/* paths fall through to adminRouter
  mountAdminDashboard(app);
  app.use('/admin', adminRouter);
  app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }));

  return app;
}
