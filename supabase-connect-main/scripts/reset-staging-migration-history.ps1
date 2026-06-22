[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string[]]$OldMigrationVersions
)

$ErrorActionPreference = 'Stop'
$stagingProjectRef = 'nunfrjcuimaytydnaqtt'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRefPath = Join-Path $projectRoot 'supabase\.temp\project-ref'

if (-not (Test-Path -LiteralPath $projectRefPath)) {
  Write-Host 'NOT STAGING - ABORT'
  exit 1
}

$linkedProjectRef = (Get-Content -LiteralPath $projectRefPath -Raw).Trim()
if ($linkedProjectRef -ne $stagingProjectRef) {
  Write-Host 'NOT STAGING - ABORT'
  exit 1
}

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) {
  throw 'SUPABASE_DB_URL is required. Set it to the staging Session Pooler PostgreSQL connection URL for this PowerShell session.'
}
if ($env:SUPABASE_DB_URL -notmatch '^postgres(?:ql)?://') {
  throw 'SUPABASE_DB_URL must be a PostgreSQL connection URL.'
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw 'Supabase CLI was not found on PATH.'
}
if ($OldMigrationVersions.Count -eq 0 -or ($OldMigrationVersions | Where-Object { $_ -notmatch '^\d+$' })) {
  throw 'Provide one or more numeric old remote migration versions with -OldMigrationVersions.'
}

Write-Warning 'This does not truncate, drop tables, or reset the database.'
Write-Warning 'It marks only the supplied old remote migration-history versions as reverted, then pushes the active staging baseline.'
Write-Warning "Target staging ref: $stagingProjectRef"
$confirmation = Read-Host 'Type exactly: RESET STAGING MIGRATION HISTORY'
if ($confirmation.Trim() -ne 'RESET STAGING MIGRATION HISTORY') {
  throw 'Staging migration-history repair cancelled.'
}

foreach ($version in $OldMigrationVersions) {
  Write-Host "Marking remote migration $version as reverted"
  & supabase migration repair --status reverted --db-url $env:SUPABASE_DB_URL $version
  if ($LASTEXITCODE -ne 0) {
    throw "Migration repair failed for version $version with exit code $LASTEXITCODE."
  }
}

Write-Host 'Pushing active staging baseline using Session Pooler database URL'
& supabase db push --db-url $env:SUPABASE_DB_URL
if ($LASTEXITCODE -ne 0) {
  throw "Staging baseline push failed with exit code $LASTEXITCODE."
}

Write-Host 'Staging migration history repaired and active baseline push completed.'
