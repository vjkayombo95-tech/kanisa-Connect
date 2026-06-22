[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
$productionProjectRef = 'cbaxiiqlzrwvmuplhusm'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRefPath = Join-Path $projectRoot 'supabase\.temp\project-ref'
$baselineDirectory = Join-Path $projectRoot 'supabase\baseline'
$outputPath = Join-Path $baselineDirectory 'production_schema_baseline.sql'
$stdoutLogPath = Join-Path $baselineDirectory 'pg_dump_stdout.log'
$stderrLogPath = Join-Path $baselineDirectory 'pg_dump_stderr.log'

if ($WhatIfPreference) {
  Write-Host 'WhatIf: script parsed successfully; no prompts, database connection, or export will run.'
  return
}

Write-Warning 'This uses pg_dump directly against the working PRODUCTION database.'
Write-Warning 'It exports schema definitions only: no table data, Auth users, or Storage objects.'
Write-Warning 'Never paste the database URL into this script, source control, terminals recorded by others, or logs.'

$pgDumpCandidatePaths = @()
$pgDumpCommand = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($pgDumpCommand -and $pgDumpCommand.Path) { $pgDumpCandidatePaths += $pgDumpCommand.Path }
$pgDumpCandidatePaths += Get-ChildItem -Path 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -File -ErrorAction SilentlyContinue |
  ForEach-Object { $_.FullName }
$pgDumpCandidatePaths = $pgDumpCandidatePaths | Select-Object -Unique

$workingPgDumps = foreach ($candidatePath in $pgDumpCandidatePaths) {
  $versionOutput = & $candidatePath --version 2>&1
  $versionExitCode = $LASTEXITCODE
  if ($versionExitCode -ne 0) {
    Write-Host "Skipped pg_dump: $candidatePath"
    continue
  }

  $majorVersion = -1
  $versionText = ($versionOutput | Out-String).Trim()
  if ($versionText -match '(?<major>\d+)') { $majorVersion = [int]$Matches.major }
  [PSCustomObject]@{
    FullName = $candidatePath
    MajorVersion = $majorVersion
  }
}

$selectedPgDump = $workingPgDumps | Sort-Object -Property @(
  @{ Expression = { $_.MajorVersion }; Descending = $true },
  @{ Expression = { $_.FullName }; Ascending = $true }
) | Select-Object -First 1
if ($selectedPgDump) { $pgDumpPath = $selectedPgDump.FullName }
if ([string]::IsNullOrWhiteSpace($pgDumpPath)) {
  throw 'No working pg_dump was found on PATH or under C:\Program Files\PostgreSQL\<version>\bin. Install or repair PostgreSQL client tools first.'
}
Write-Host "Selected pg_dump: $pgDumpPath"
if (-not (Test-Path -LiteralPath $projectRefPath)) { throw "No linked project reference found at $projectRefPath." }
$linkedProjectRef = (Get-Content -LiteralPath $projectRefPath -Raw).Trim()
if ($linkedProjectRef -ne $productionProjectRef) {
  throw "Refusing export: linked project is '$linkedProjectRef', not production '$productionProjectRef'."
}
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_PRODUCTION_DB_URL)) {
  throw 'Set SUPABASE_PRODUCTION_DB_URL to the production direct PostgreSQL connection URL for this PowerShell session.'
}
if ($env:SUPABASE_PRODUCTION_DB_URL -notmatch '^postgres(?:ql)?://') {
  throw 'SUPABASE_PRODUCTION_DB_URL must be a PostgreSQL connection URL.'
}

Write-Host 'Type environment name exactly: production'
$environmentName = Read-Host 'Environment'
$environmentName = $environmentName.Trim()
if ($environmentName -ne 'production') {
  throw "Production export cancelled. Received: '$environmentName'"
}

Write-Host 'Type exactly: I UNDERSTAND THIS TARGETS PRODUCTION'
$ack = Read-Host 'Acknowledgement'
$ack = $ack.Trim()
if ($ack -ne 'I UNDERSTAND THIS TARGETS PRODUCTION') {
  throw "Production export cancelled. Received acknowledgement: '$ack'"
}

New-Item -ItemType Directory -Path $baselineDirectory -Force | Out-Null
if (Test-Path -LiteralPath $outputPath) { throw "Refusing to overwrite existing baseline: $outputPath" }
Remove-Item -LiteralPath $stdoutLogPath, $stderrLogPath -Force -ErrorAction SilentlyContinue

# --schema-only excludes all rows, including auth.users and storage.objects.
# Restricting schemas avoids exporting Auth schema definitions or data.
Write-Host "Using pg_dump: $pgDumpPath"
Write-Host 'pg_dump version:'
& $pgDumpPath --version
Write-Host "Baseline output path: $outputPath"

& $pgDumpPath --schema-only --no-owner --no-privileges --schema=public --schema=storage --file=$outputPath $env:SUPABASE_PRODUCTION_DB_URL 1> $stdoutLogPath 2> $stderrLogPath
$pgDumpExitCode = $LASTEXITCODE
if ($pgDumpExitCode -ne 0) {
  Write-Error "pg_dump failed with exit code $pgDumpExitCode."
  Write-Host "Last 50 stderr lines ($stderrLogPath):"
  if (Test-Path -LiteralPath $stderrLogPath) { Get-Content -LiteralPath $stderrLogPath -Tail 50 }
  Write-Host "Last 20 stdout lines ($stdoutLogPath):"
  if (Test-Path -LiteralPath $stdoutLogPath) { Get-Content -LiteralPath $stdoutLogPath -Tail 20 }
  Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
  throw "pg_dump failed with exit code $pgDumpExitCode. See $stderrLogPath and $stdoutLogPath."
}

if (-not (Test-Path -LiteralPath $outputPath) -or (Get-Item -LiteralPath $outputPath).Length -eq 0) {
  Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
  throw "pg_dump reported success but did not create a non-empty baseline. See $stderrLogPath and $stdoutLogPath."
}

Write-Host "Schema-only baseline written to $outputPath"
