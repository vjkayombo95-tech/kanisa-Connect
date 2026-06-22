[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$promotionDirectory = Join-Path $projectRoot 'supabase\production_promotions'

# This is a production promotion tool, not a staging rebuild tool.
# It must never apply production_baseline.sql or any storage migration.
Write-Warning 'This script applies reviewed additive SQL migrations to the PRODUCTION database.'
Write-Warning 'It is not for staging rebuilds and must never execute production_baseline.sql.'
Write-Warning 'Do not paste database URLs into this script, source control, or logs.'

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_PRODUCTION_DB_URL)) {
  throw 'Set SUPABASE_PRODUCTION_DB_URL to the production PostgreSQL connection URL for this PowerShell session.'
}

if ($env:SUPABASE_PRODUCTION_DB_URL -notmatch '^postgres(?:ql)?://') {
  throw 'SUPABASE_PRODUCTION_DB_URL must be a PostgreSQL connection URL.'
}

if (-not (Test-Path -LiteralPath $promotionDirectory)) {
  throw "Production promotion directory is missing: $promotionDirectory"
}

$promotionFiles = Get-ChildItem -LiteralPath $promotionDirectory -File -Filter '*.sql' |
  Sort-Object Name

if ($promotionFiles.Count -eq 0) {
  throw "No SQL promotion files were found in $promotionDirectory"
}

$blockedFiles = $promotionFiles | Where-Object {
  $_.Name -match '(?i)(baseline|storage)'
}
if ($blockedFiles) {
  throw "Refusing to apply baseline or storage migrations: $($blockedFiles.Name -join ', ')"
}

$psqlCandidates = @()
$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlCommand -and $psqlCommand.Path) {
  $psqlCandidates += $psqlCommand.Path
}
$psqlCandidates += Get-ChildItem -Path 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -File -ErrorAction SilentlyContinue |
  ForEach-Object { $_.FullName }
$psqlCandidates = $psqlCandidates | Select-Object -Unique

$workingPsql = foreach ($candidate in $psqlCandidates) {
  $versionOutput = & $candidate --version 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Skipped psql: $candidate"
    continue
  }

  $versionText = ($versionOutput | Out-String).Trim()
  $majorVersion = -1
  if ($versionText -match '(?<major>\d+)') {
    $majorVersion = [int]$Matches.major
  }

  [PSCustomObject]@{
    Path = $candidate
    MajorVersion = $majorVersion
  }
}

$psql = $workingPsql | Sort-Object -Property @(
  @{ Expression = { $_.MajorVersion }; Descending = $true },
  @{ Expression = { $_.Path }; Ascending = $true }
) | Select-Object -First 1

if (-not $psql) {
  throw 'No working psql was found on PATH or under C:\Program Files\PostgreSQL\<version>\bin.'
}

Write-Host 'Type environment name exactly: production'
$environmentName = (Read-Host 'Environment').Trim()
if ($environmentName -cne 'production') {
  throw "Production promotion cancelled. Received: '$environmentName'"
}

Write-Host 'Type exactly: PROMOTE PRODUCTION'
$confirmation = (Read-Host 'Confirmation').Trim()
if ($confirmation -cne 'PROMOTE PRODUCTION') {
  throw "Production promotion cancelled. Received confirmation: '$confirmation'"
}

Write-Host "Using psql: $($psql.Path)"
foreach ($promotionFile in $promotionFiles) {
  $sqlFilePath = $promotionFile.FullName
  Write-Host "Applying $($promotionFile.Name)"
  & $psql.Path --set=ON_ERROR_STOP=1 --single-transaction --dbname=$env:SUPABASE_PRODUCTION_DB_URL --file=$sqlFilePath
  if ($LASTEXITCODE -ne 0) {
    throw "Production promotion stopped: $($promotionFile.Name) failed with exit code $LASTEXITCODE."
  }
}

Write-Host 'Production promotion completed.'
