const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const dotenv = require("dotenv");
const { createTRPCProxyClient, httpBatchLink } = require("@trpc/client");
const superjsonModule = require("superjson");

const superjson = superjsonModule.default ?? superjsonModule;
const rootDir = path.resolve(__dirname, "..");

loadEnv(".env");
loadEnv(".env.local");

if (process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

const isolated = process.argv.includes("--isolated");
(isolated ? runIsolated() : runAttached()).catch((error) => {
  console.error(`[local-smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function runAttached() {
  const apiPort = process.env.LOCAL_API_PORT || process.env.PORT || "3011";
  const webPort = process.env.LOCAL_WEB_PORT || "8081";
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || `http://localhost:${apiPort}`;
  const webUrl = `http://localhost:${webPort}`;

  console.log(`[local-smoke] api=${apiUrl}`);
  console.log(`[local-smoke] web=${webUrl}`);

  const api = await checkJson(`${apiUrl}/api/health`, (json) => json && json.ok === true);
  const web = await checkText(webUrl, (text) => /m'AI Touch|Loading|Staff Login|Digital Brain/i.test(text));

  console.log(`[local-smoke] API OK (${api.status}) ${api.url}`);
  console.log(`[local-smoke] WEB OK (${web.status}) ${web.url}`);
  console.log("[local-smoke] Attached smoke check passed");
}

async function runIsolated() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mai-touch-smoke-"));
  const databasePath = path.join(tempRoot, "smoke.db");
  const port = await findFreePort();
  const apiUrl = `http://127.0.0.1:${port}`;
  const residentToken = "smoke-resident-token";
  const adminToken = "smoke-admin-token";
  const provider = await startContractProvider();
  const tsxCli = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
  const isolatedEnv = {
    ...process.env,
    NODE_ENV: "test",
    DEPLOY_PROFILE: "prod",
    DB_TYPE: "sqlite",
    DATABASE_URL: "",
    SQLITE_FILENAME: databasePath,
    PORT: String(port),
    BASE_URL: apiUrl,
    FRONTEND_URL: "http://127.0.0.1:8081",
    CORS_ORIGINS: "http://127.0.0.1:8081",
    WEB_RESIDENT_TOKEN: residentToken,
    WEB_ADMIN_TOKEN: adminToken,
    WEB_LOGISTICS_TOKEN: "smoke-logistics-token",
    NLP_SERVICE_ENABLED: "false",
    LINE_CHANNEL_SECRET: "",
    LINE_CHANNEL_ACCESS_TOKEN: "",
    OPENAI_API_KEY: "smoke-provider-key",
    OPENAI_BASE_URL: provider.baseUrl,
    SESSION_SECRET: "smoke-only-session-secret-not-for-production",
  };
  let server;
  let serverOutput = "";

  try {
    console.log(`[local-smoke] isolated-db=${databasePath}`);
    const initialized = spawnSync(process.execPath, [tsxCli, "scripts/init-db-demo.ts"], {
      cwd: rootDir,
      env: isolatedEnv,
      encoding: "utf8",
      timeout: 30_000,
    });
    if (initialized.status !== 0) {
      throw new Error(`database initialization failed: ${initialized.stderr || initialized.stdout}`);
    }

    server = spawn(process.execPath, [tsxCli, "src/server/index.ts"], {
      cwd: rootDir,
      env: isolatedEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const capture = (chunk) => {
      serverOutput = `${serverOutput}${chunk}`.slice(-12_000);
    };
    server.stdout.on("data", capture);
    server.stderr.on("data", capture);
    await waitForHealth(`${apiUrl}/api/health`, server);

    const health = await checkJson(`${apiUrl}/api/health`, (json) => json?.ok === true);
    console.log(`[local-smoke] liveness PASS (${health.status})`);

    const resident = makeClient(apiUrl, residentToken);
    const admin = makeClient(apiUrl, adminToken);
    const me = await resident.auth.me.query();
    assert(me?.role === "resident" && me?.id === 1, "resident authentication contract failed");
    console.log("[local-smoke] resident auth PASS");

    let residentDenied = false;
    try {
      await resident.system.diagnostics.query();
    } catch {
      residentDenied = true;
    }
    assert(residentDenied, "resident unexpectedly accessed admin diagnostics");
    const diagnostics = await admin.system.diagnostics.query();
    assert(diagnostics.services.database.status === "healthy", "database integrity probe was not healthy");
    assert(diagnostics.services.ai.status === "healthy", "AI provider contract probe was not healthy");
    assert(diagnostics.services.nlp.status === "unconfigured", "NLP status must be unconfigured when disabled");
    console.log("[local-smoke] diagnostics authorization + truth PASS");

    const amenities = await resident.amenities.list.query();
    assert(Array.isArray(amenities) && amenities.length > 0, "seed amenities unavailable");
    const bookingId = await resident.bookings.create.mutate({
      amenityId: amenities[0].id,
      date: "2099-12-31",
      startTime: "08:00",
      endTime: "09:00",
      guestCount: 1,
      notes: "isolated smoke",
    });
    let bookings = await resident.bookings.myBookings.query();
    assert(bookings.some((booking) => booking.id === bookingId), "confirmed booking was not readable");
    await resident.bookings.cancel.mutate({ id: bookingId });
    bookings = await resident.bookings.myBookings.query();
    assert(bookings.find((booking) => booking.id === bookingId)?.status === "cancelled", "booking cancellation did not persist");
    console.log("[local-smoke] booking write/read/cancel PASS");

    const historyBefore = await resident.chat.history.query({ limit: 100, viewerKey: "smoke" });
    let chatRejected = false;
    try {
      await resident.chat.send.mutate({ message: "[force-provider-failure]", language: "en" });
    } catch {
      chatRejected = true;
    }
    assert(chatRejected, "unconfigured chat must reject instead of fabricating an answer");
    const historyAfter = await resident.chat.history.query({ limit: 100, viewerKey: "smoke" });
    const added = historyAfter.slice(historyBefore.length);
    assert(added.filter((message) => message.role === "user").length === 1, "failed chat user message was not recorded exactly once");
    assert(added.every((message) => message.role !== "assistant"), "failed provider produced a fake assistant message");
    console.log("[local-smoke] chat failure/no-fabrication PASS");

    const success = await resident.chat.send.mutate({ message: "Test provider contract", language: "en" });
    assert(success.text === "Verified provider response.", "provider success response was not returned");
    const historySuccess = await resident.chat.history.query({ limit: 100, viewerKey: "smoke" });
    assert(historySuccess.some((message) => message.role === "assistant" && message.content === success.text), "provider response was not persisted");
    console.log("[local-smoke] chat provider HTTP success contract PASS");
    console.log("[local-smoke] live external AI UNAVAILABLE (OPENAI_API_KEY is not configured in this workspace)");

    await checkStaticExport();
    console.log("[local-smoke] static web export PASS");
    console.log("[local-smoke] Isolated system smoke passed");
  } catch (error) {
    if (serverOutput.trim()) console.error(`[local-smoke] server tail:\n${serverOutput}`);
    throw error;
  } finally {
    if (server && !server.killed) server.kill();
    await new Promise((resolve) => provider.server.close(resolve));
    await new Promise((resolve) => setTimeout(resolve, 250));
    const expectedPrefix = `${path.resolve(os.tmpdir())}${path.sep}`;
    if (path.resolve(tempRoot).startsWith(expectedPrefix)) {
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      } catch (error) {
        console.warn(`[local-smoke] temporary cleanup deferred: ${error.message}`);
      }
    }
  }
}

async function startContractProvider() {
  const server = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [] }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
      response.writeHead(404);
      response.end();
      return;
    }

    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      let latestUser = "";
      try {
        const payload = JSON.parse(body);
        const userMessage = [...(payload.messages ?? [])]
          .reverse()
          .find((message) => message.role === "user");
        latestUser = JSON.stringify(userMessage?.content ?? "");
      } catch {}
      if (latestUser.includes("[force-provider-failure]")) {
        response.writeHead(503, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "isolated provider failure" } }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        id: "chatcmpl-isolated-smoke",
        created: 1_725_000_000,
        model: "smoke-contract-provider",
        choices: [{
          index: 0,
          message: { role: "assistant", content: "Verified provider response." },
          finish_reason: "stop",
        }],
      }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1` };
}

function makeClient(apiUrl, token) {
  return createTRPCProxyClient({
    transformer: superjson,
    links: [httpBatchLink({
      url: `${apiUrl}/api/trpc`,
      headers: { Authorization: `Bearer ${token}` },
    })],
  });
}

async function checkStaticExport() {
  const indexPath = path.join(rootDir, "dist", "index.html");
  const faviconPath = path.join(rootDir, "dist", "favicon.ico");
  assert(fs.existsSync(indexPath), "dist/index.html is missing; run npm run web:build");
  assert(fs.existsSync(faviconPath), "dist/favicon.ico is missing");

  const staticServer = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fs.readFileSync(indexPath));
  });
  await new Promise((resolve) => staticServer.listen(0, "127.0.0.1", resolve));
  const address = staticServer.address();
  try {
    await checkText(`http://127.0.0.1:${address.port}`, (text) => /<html|<!doctype/i.test(text));
  } finally {
    await new Promise((resolve) => staticServer.close(resolve));
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server did not become ready: ${url}`);
}

async function checkJson(url, validate) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`);
  const json = await response.json();
  if (!validate(json)) throw new Error(`Unexpected JSON response from ${url}`);
  return { status: response.status, url };
}

async function checkText(url, validate) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`);
  const body = await response.text();
  if (!validate(body)) throw new Error(`Unexpected text response from ${url}`);
  return { status: response.status, url };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadEnv(fileName) {
  const filePath = path.join(rootDir, fileName);
  if (fs.existsSync(filePath)) dotenv.config({ path: filePath, override: false });
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run local:smoke          # checks already-running API and web servers");
  console.log("  npm run smoke:system         # isolated SQLite/API/static-export system smoke");
}
