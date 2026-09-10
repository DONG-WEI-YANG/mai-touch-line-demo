import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';

it.skipIf(process.platform !== 'win32')('runs the complete operator workflow using a fake gcloud and real SQLite restore', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-operator-'));
  const fixture = path.join(dir, 'fixture.db');
  const db = new Database(fixture);
  db.exec('CREATE TABLE history(id INTEGER); INSERT INTO history VALUES(1)');
  db.close();
  const harness = path.join(dir, 'harness.ps1');
  fs.writeFileSync(harness, `
$ErrorActionPreference='Stop'
function global:gcloud {
  $items=@($args)
  $global:LASTEXITCODE=0
  if ($items[0] -eq 'storage' -and $items[1] -eq 'buckets') {
    return '{"public_access_prevention":"enforced","uniform_bucket_level_access":true}'
  }
  if ($items[0] -eq 'compute' -and $items[1] -eq 'ssh') {
    $command = ($items | Where-Object { $_ -like '--command=*' })
    if ($command -like '*sha256sum*') {
      $remote=[regex]::Match($command,'/tmp/mai-touch-offsite-[a-f0-9]{32}\\.db').Value
      return (Get-FileHash -LiteralPath $env:TEST_FIXTURE).Hash.ToLowerInvariant()+'  '+$remote
    }
    return
  }
  if ($items[0] -eq 'compute' -and $items[1] -eq 'scp') { Copy-Item -LiteralPath $env:TEST_FIXTURE -Destination $items[3]; return }
  if ($items[0] -eq 'storage' -and $items[1] -eq 'cp') {
    if ($items[2] -like 'gs://*') { Copy-Item -LiteralPath $env:TEST_FIXTURE -Destination $items[3]; return }
    if ($items -notcontains '--if-generation-match=0') { throw 'missing creation guard' }
    return
  }
  throw 'Unexpected command'
}
& $env:TEST_BACKUP -Bucket private-test-bucket -Account operator@example.com
`);
  let created: string | undefined;
  try {
    const output = execFileSync('pwsh', ['-NoProfile', '-File', harness], {
      encoding: 'utf8', env: { ...process.env, TEST_FIXTURE: fixture, TEST_BACKUP: path.resolve('scripts/gcp-offsite-backup.ps1') },
    });
    const match = output.match(/_local\/offsite\/([a-f0-9]{32})\/receipt\.json/);
    expect(match).not.toBeNull();
    created = path.resolve('_local/offsite', match![1]);
    expect(JSON.parse(fs.readFileSync(path.join(created, 'receipt.json'), 'utf8'))).toMatchObject({ status: 'verified', restoredToNewFile: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    if (created) fs.rmSync(created, { recursive: true, force: true });
  }
});
