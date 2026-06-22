[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$productionProjectRef = 'cbaxiiqlzrwvmuplhusm'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRefPath = Join-Path $projectRoot 'supabase\.temp\project-ref'
$baselineDirectory = Join-Path $projectRoot 'supabase\baseline'
$outputPath = Join-Path $baselineDirectory 'production_schema_baseline.sql'

Write-Warning 'This exports schema definitions from the working PRODUCTION database.'
Write-Warning 'It must never be used to export production data, Auth users, Storage objects, or credentials.'
if (-not (Test-Path -LiteralPath $projectRefPath)) { throw "No linked project reference found at $projectRefPath." }
$linkedProjectRef = (Get-Content -LiteralPath $projectRefPath -Raw).Trim()
if ($linkedProjectRef -ne $productionProjectRef) {
  throw "Refusing export: linked project is '$linkedProjectRef', not production '$productionProjectRef'."
}

$environmentName = Read-Host 'Enter environment name: production'
if ($environmentName -cne 'production') { throw 'Production export cancelled.' }
$confirmation = Read-Host "Type exactly: I UNDERSTAND THIS TARGETS PRODUCTION"
if ($confirmation -cne 'I UNDERSTAND THIS TARGETS PRODUCTION') { throw 'Production export cancelled.' }

New-Item -ItemType Directory -Path $baselineDirectory -Force | Out-Null
if (Test-Path -LiteralPath $outputPath) { throw "Refusing to overwrite existing baseline: $outputPath" }

# Schema-only public/storage definitions. No --data-only flag is used; Storage
# object rows and Auth data are not exported by this command.
& supabase db dump --linked --schema public --schema storage --file $outputPath
if ($LASTEXITCODE -ne 0) { throw "Schema export failed with exit code $LASTEXITCODE." }

Write-Host "Schema-only baseline written to $outputPath"
