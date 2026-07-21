const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");

loadEnv(".env");
loadEnv(".env.local");

const apiPort = process.env.LOCAL_API_PORT || process.env.PORT || "3011";
const webPort = process.env.LOCAL_WEB_PORT || "8081";
const apiUrl = process.env.EXPO_PUBLIC_API_URL || `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;

if (process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

run().catch((error) => {
  console.error(`[local-smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

async function run() {
  console.log(`[local-smoke] api=${apiUrl}`);
  console.log(`[local-smoke] web=${webUrl}`);

  const api = await checkJson(`${apiUrl}/api/health`, (json) => json && json.ok === true);
  const web = await checkText(webUrl, (text) => /m'AI Touch|Loading|Staff Login|Digital Brain/i.test(text));

  console.log(`[local-smoke] API OK (${api.status}) ${api.url}`);
  console.log(`[local-smoke] WEB OK (${web.status}) ${web.url}`);
  console.log("[local-smoke] Smoke check passed");
}

async function checkJson(url, validate) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  const json = await response.json();
  if (!validate(json)) {
    throw new Error(`Unexpected JSON response from ${url}: ${JSON.stringify(json)}`);
  }

  return { status: response.status, url };
}

async function checkText(url, validate) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  const text = await response.text();
  if (!validate(text)) {
    throw new Error(`Unexpected HTML response from ${url}`);
  }

  return { status: response.status, url };
}

function loadEnv(fileName) {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) return;
  dotenv.config({ path: filePath, override: false });
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run local:smoke");
  console.log("");
  console.log("Checks:");
  console.log("  - GET <api>/api/health");
  console.log("  - GET <web>/");
  console.log("");
  console.log("Resolved from .env / .env.local:");
  console.log("  LOCAL_API_PORT=3011");
  console.log("  LOCAL_WEB_PORT=8081");
  console.log("  EXPO_PUBLIC_API_URL=http://localhost:3011");
}
