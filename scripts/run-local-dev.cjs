const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");

loadEnv(".env");
loadEnv(".env.local");

const mode = process.argv[2] || "help";
const apiPort = process.env.LOCAL_API_PORT || process.env.PORT || "3011";
const webPort = process.env.LOCAL_WEB_PORT || "8081";
const apiUrl = process.env.EXPO_PUBLIC_API_URL || `http://localhost:${apiPort}`;
const frontendUrl = `http://localhost:${webPort}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

if (mode === "help") {
  printHelp();
  process.exit(0);
}

if (mode !== "server" && mode !== "web") {
  console.error(`[local-dev] Unknown mode: ${mode}`);
  printHelp();
  process.exit(1);
}

const sharedEnv = {
  ...process.env,
  PORT: apiPort,
  BASE_URL: apiUrl,
  FRONTEND_URL: frontendUrl,
  EXPO_PUBLIC_API_URL: apiUrl,
  CORS_ORIGINS:
    process.env.CORS_ORIGINS ||
    [
      frontendUrl,
      `http://127.0.0.1:${webPort}`,
      "http://localhost:8082",
      "http://127.0.0.1:8082",
      "http://localhost:8083",
      "http://127.0.0.1:8083",
      "http://localhost:19006",
      "http://127.0.0.1:19006",
    ].join(","),
};

const args =
  mode === "server"
    ? ["run", "server"]
    : ["run", "web", "--", "--port", webPort];

console.log(`[local-dev] mode=${mode}`);
console.log(`[local-dev] api=${apiUrl}`);
console.log(`[local-dev] web=${frontendUrl}`);

const child = spawn(npmCommand, args, {
  cwd: rootDir,
  env: sharedEnv,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function loadEnv(fileName) {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) return;
  dotenv.config({ path: filePath, override: false });
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run local:server");
  console.log("  npm run local:web");
  console.log("");
  console.log("Optional .env.local values:");
  console.log("  LOCAL_API_PORT=3011");
  console.log("  LOCAL_WEB_PORT=8081");
  console.log("  EXPO_PUBLIC_API_URL=http://localhost:3011");
}
