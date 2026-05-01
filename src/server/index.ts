import 'dotenv/config';
import { createServer } from 'http';
import net from 'net';
import { createApp } from './app';
import * as db from './db';
import { startAuditCleanupScheduler } from './audit-cleanup-scheduler';

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
