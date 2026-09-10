[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$')][string]$Bucket,
  [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9._+@-]+$')][string]$Account,
  [ValidateSet('mai-touch-history-20260908')][string]$Project = 'mai-touch-history-20260908',
  [ValidateSet('mai-touch-demo')][string]$Instance = 'mai-touch-demo',
  [ValidateSet('us-west1-b')][string]$Zone = 'us-west1-b',
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$runId = [Guid]::NewGuid().ToString('N')
$runDir = Join-Path $repo "_local/offsite/$runId"
$remote = "/tmp/mai-touch-offsite-$runId.db"
$object = "gs://$Bucket/mai-touch/$([DateTime]::UtcNow.ToString('yyyy-MM-dd'))/$runId.db"
$step = 'preflight'

# Do not echo commands, stderr, environment, tokens, or database contents.
function Invoke-Checked([string]$Program, [string[]]$Arguments) {
  $output = & $Program @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'External command failed' }
  return ($output | ForEach-Object { $_.ToString() }) -join "`n"
}
function Invoke-Gcloud([string[]]$Arguments) {
  Invoke-Checked 'gcloud' ($Arguments + @("--project=$Project", "--account=$Account", '--quiet', '--verbosity=error'))
}
function Invoke-Vm([string]$Command) {
  Invoke-Gcloud @('compute', 'ssh', $Instance, "--zone=$Zone", '--tunnel-through-iap', "--command=$Command")
}

if ($DryRun) {
  Write-Output 'DRY RUN: no commands, cloud connections, resource creation, or local files.'
  Write-Output 'Steps: validate existing private bucket; Online Backup via IAP; download; verify; upload unique object; download again; SHA256 + SQLite restore drill to new file; success receipt.'
  exit 0
}

try {
  New-Item -ItemType Directory -Path $runDir -ErrorAction Stop | Out-Null
  $step = 'private-bucket-check'
  $metadata = (Invoke-Gcloud @('storage', 'buckets', 'describe', "gs://$Bucket", '--format=json')) | ConvertFrom-Json
  # gcloud uses snake_case; tolerate the equivalent Storage JSON API shape.
  $pap = $metadata.public_access_prevention
  $uniform = $metadata.uniform_bucket_level_access
  if ($metadata.iamConfiguration) {
    $pap = $metadata.iamConfiguration.publicAccessPrevention
    $uniform = $metadata.iamConfiguration.uniformBucketLevelAccess.enabled
  }
  if ($pap -ne 'enforced' -or $uniform -ne $true) { throw 'Bucket must enforce public access prevention and uniform access' }

  $step = 'vm-online-backup'
  # Only the locally generated hexadecimal run ID enters this fixed shell program.
  $command = 'set -eu; snapshot=$(sudo node /opt/mai-touch/current/snapshot.js backup /var/data/mai-touch.db /var/data/backups); case "$snapshot" in /var/data/backups/mai-touch-*.db) ;; *) exit 1;; esac; sudo install -m 600 -o "$(id -u)" -g "$(id -g)" "$snapshot" ' + $remote + '; sha256sum ' + $remote
  $checksumOutput = Invoke-Vm $command
  $sha = [regex]::Match($checksumOutput, '(?m)^([a-f0-9]{64})\s+/tmp/mai-touch-offsite-[a-f0-9]{32}\.db\s*$').Groups[1].Value
  if ($sha.Length -ne 64) { throw 'Snapshot checksum missing' }
  $source = Join-Path $runDir 'source.db'
  $step = 'iap-download'
  Invoke-Gcloud @('compute', 'scp', "${Instance}:$remote", $source, "--zone=$Zone", '--tunnel-through-iap') | Out-Null
  if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha) { throw 'IAP download checksum mismatch' }
  # The exact generated /tmp path is the only remote file removed; live DB and snapshots remain.
  Invoke-Vm ('rm -- ' + $remote) | Out-Null

  $step = 'local-integrity-check'
  Push-Location $repo
  try { Invoke-Checked 'node' @('--import', 'tsx', 'scripts/database-snapshot.ts', 'verify', $source) | Out-Null }
  finally { Pop-Location }
  $step = 'upload-new-object'
  Invoke-Gcloud @('storage', 'cp', $source, $object, '--if-generation-match=0') | Out-Null
  $download = Join-Path $runDir 'download.db'
  if (Test-Path -LiteralPath $download) { throw 'Download target exists' }
  $step = 'offsite-download'
  Invoke-Gcloud @('storage', 'cp', $object, $download, '--no-clobber') | Out-Null
  $step = 'restore-drill'
  Push-Location $repo
  try { Invoke-Checked 'node' @('--import', 'tsx', 'scripts/offsite-restore-drill.ts', $download, $sha, (Join-Path $runDir 'restored.db')) | Out-Null }
  finally { Pop-Location }
  $receipt = @{ status = 'verified'; checkedAt = [DateTime]::UtcNow.ToString('o'); object = $object; sha256 = $sha; integrity = 'ok'; foreignKeys = 'ok'; restoredToNewFile = $true }
  $receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDir 'receipt.json')
  Write-Output "Offsite backup and restore drill verified. Receipt: _local/offsite/$runId/receipt.json"
} catch {
  # No raw SDK output: it can contain account details or request diagnostics.
  Write-Error "Offsite backup failed at stage '$step'. No verified success receipt was issued; retained artifacts are in _local/offsite/$runId." -ErrorAction Continue
  exit 1
}
