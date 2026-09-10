const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const ORIGIN = 'https://mai-touch-history-20260908.web.app';
function validateReleaseEnv(front, back) {
  if (front.EXPO_PUBLIC_API_URL !== ORIGIN) throw new Error('EXPO_PUBLIC_API_URL must equal the current Firebase origin');
  for (const role of ['ADMIN', 'LOGISTICS', 'RESIDENT']) {
    const name = `EXPO_PUBLIC_DEMO_${role}_TOKEN`;
    const value = front[name];
    if (!value || value.length < 24 || /^(example|changeme|demo|test)/i.test(value)) throw new Error(`${name} missing or placeholder`);
    if (value !== back[`WEB_${role}_TOKEN`]) throw new Error(`${role} frontend/backend credential mismatch`);
  }
  if (back.APP_PROFILE === 'production') throw new Error('This builder targets the current Demo, whose shared tokens are disabled by production profile');
}
function readIgnoredEnv(filename) {
  if (!filename) throw new Error('Explicit ignored env file required');
  const resolved = path.resolve(filename);
  const ignored = spawnSync('git', ['check-ignore', '--quiet', '--', resolved]);
  if (ignored.status !== 0) throw new Error('Environment file must be Git-ignored');
  return dotenv.parse(fs.readFileSync(resolved));
}
function main() {
  const [frontFile, backendFile] = process.argv.slice(2);
  const front = readIgnoredEnv(frontFile);
  const back = readIgnoredEnv(backendFile);
  validateReleaseEnv(front, back);
  const env = { ...process.env, EXPO_NO_DOTENV: '1' };
  for (const name of Object.keys(env)) if (/^(WEB_|LINE_|OPENAI_|GOOGLE_|GEMINI_)/.test(name)) delete env[name];
  for (const name of Object.keys(env)) if (name.startsWith('EXPO_PUBLIC_')) delete env[name];
  for (const [name, value] of Object.entries(front)) if (name.startsWith('EXPO_PUBLIC_')) env[name] = value;
  env.EXPO_PUBLIC_WEB_URL = ORIGIN;
  // Backend credentials never enter the child environment. Expo's dotenv loading is disabled.
  const result = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'export', '-p', 'web', '--output-dir', 'dist', '--clear'], { env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Frontend export failed');
  fs.mkdirSync('_local', { recursive: true });
  fs.writeFileSync('_local/firebase-release.json', JSON.stringify({ origin: ORIGIN, createdAt: new Date().toISOString(), config: 'firebase.gcp.json' }, null, 2));
  console.log('Verified Demo frontend built. No deployment performed.');
}
module.exports = { validateReleaseEnv };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
