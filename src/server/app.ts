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
import { dispatch, getDispatchDeps } from './line/dispatcher';

export function createApp(): express.Express {
  const app = express();

  // CORS — same logic as before
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3000'];

  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
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
    res.json({
      ok: true,
      profile: getProfile(),
      db: 'ok',
      ai_provider: getProfile() === 'demo' ? 'openai' : 'nlp-service',
      uptime_s: Math.floor(process.uptime()),
    });
  });

  registerOAuthRoutes(app);
  app.use('/admin', adminRouter);
  app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }));

  return app;
}
