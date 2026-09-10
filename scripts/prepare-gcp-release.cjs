// Prepare the existing backend bundle plus a checksummed deployment payload.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['scripts/build-gcp-backend.cjs'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(1);
const source = path.resolve('_local/gcp/backend');
const target = path.resolve('_local/gcp/release-' + Date.now());
fs.mkdirSync(target, { recursive: true });
for (const name of ['server.js', 'snapshot.js', 'package.json', 'migrations']) fs.cpSync((name === 'migrations' ? path.resolve('migrations') : path.join(source, name)), path.join(target, name), { recursive: true });
const files = [];
function walk(dir) {
 for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
  const filename = path.join(dir, item.name);
  if (item.isDirectory()) walk(filename);
  else if (item.isFile()) files.push(path.relative(target, filename).split(path.sep).join('/'));
  else throw new Error('Unexpected release entry');
 }
}
walk(target);
fs.writeFileSync(path.join(target, 'SHA256SUMS'), files.sort().map(name => crypto.createHash('sha256').update(fs.readFileSync(path.join(target,name))).digest('hex') + '  ' + name).join('\n')+'\n');
console.log('Upload release directory:', target);
