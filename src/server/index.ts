import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "./routers/index";
import { adminRouter } from "./admin";
import { createContext } from "./_core/context";
import * as db from "./db";
import { startAuditCleanupScheduler } from "./audit-cleanup-scheduler";
import {
  authLimiter,
  voiceLimiter,
  chatLimiter,
  adminLimiter,
  trustedIPRateLimit
} from "./middleware/rateLimit";
import { smartCacheMiddleware } from "./middleware/cache";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Ensure real data exists
  await db.seedSystemIfEmpty();
  startAuditCleanupScheduler();
  
  const app = express();
  const server = createServer(app);

  // CORS configuration — whitelist-based instead of reflecting any origin
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:8081", "http://localhost:19006", "http://localhost:3000"];

  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  }));

  // Basic middleware
  app.use(cookieParser());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Rate limiting
  app.use("/api/auth/*", authLimiter);
  app.use("/api/voice/*", voiceLimiter);
  app.use("/api/chat/*", chatLimiter);
  app.use("/api/admin/*", adminLimiter);
  app.use("/api/*", trustedIPRateLimit);

  // Caching middleware for GET requests
  app.use("/api/*", smartCacheMiddleware());

  // Health check (no rate limiting)
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // OAuth routes
  registerOAuthRoutes(app);

  // Admin dashboard routes
  app.use("/admin", adminRouter);

  // tRPC routes
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
