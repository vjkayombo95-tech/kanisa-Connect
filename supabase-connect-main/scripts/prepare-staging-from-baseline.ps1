[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$stagingProjectRef = 'nunfrjcuimaytydnaqtt'
$productionProjectRef = 'cbaxiiqlzrwvmuplhusm'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRefPath = Join-Path $projectRoot 'supabase\.temp\project-ref'
$baselinePath = Join-Path $projectRoot 'supabase\baseline\production_schema_baseline.sql'

Write-Warning 'This applies the reviewed baseline to STAGING only. It must never target production.'
if (-not (Test-Path -LiteralPath $projectRefPath)) { throw "No linked project reference found at $projectRefPath." }
if (-not (Test-Path -LiteralPath $baselinePath)) { throw "Baseline file is missing: $baselinePath" }
$linkedProjectRef = (Get-Content -LiteralPath $projectRefPath -Raw).Trim()
if ($linkedProjectRef -eq $productionProjectRef -or $linkedProjectRef -ne $stagingProjectRef) {
  throw "Refusing baseline apply: linked project '$linkedProjectRef' is not the approved staging project '$stagingProjectRef'."
}

$environmentName = Read-Host 'Enter environment name: staging'
if ($environmentName -cne 'staging') { throw 'Staging baseline apply cancelled.' }
$confirmation = Read-Host "Type exactly: I UNDERSTAND THIS TARGETS STAGING"
if ($confirmation -cne 'I UNDERSTAND THIS TARGETS STAGING') { throw 'Staging baseline apply cancelled.' }

# Prefer an explicitly supplied Session Pooler connection URL; otherwise use
# the locally linked staging project established by the checks above.
if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) {
  Write-Host 'Using Session Pooler database URL'
  & supabase db push --db-url $env:SUPABASE_DB_URL
} else {
  Write-Host 'Using linked Supabase project'
  & supabase db push
}
if ($LASTEXITCODE -ne 0) { throw "Staging baseline apply failed with exit code $LASTEXITCODE." }

Write-Host 'Baseline apply completed. Run the verification checklist before any seed or load test.'
