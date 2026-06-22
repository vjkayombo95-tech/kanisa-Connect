[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$stagingProjectRef = 'nunfrjcuimaytydnaqtt'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tempDirectory = Join-Path $projectRoot 'supabase\.temp'
$projectRefPath = Join-Path $tempDirectory 'project-ref'
$profilePath = Join-Path $tempDirectory 'profile'

Write-Warning 'This bypasses supabase link API validation. Use only when the Supabase CLI link request times out.'
Write-Warning 'It writes the approved staging ref only and does not contact production or run any database command.'

New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null
Set-Content -LiteralPath $projectRefPath -Value $stagingProjectRef -NoNewline
Set-Content -LiteralPath $profilePath -Value 'supabase' -NoNewline

Write-Host 'Verified supabase/.temp/project-ref:'
Get-Content -LiteralPath $projectRefPath

if ((Get-Content -LiteralPath $projectRefPath -Raw).Trim() -ne $stagingProjectRef) {
  throw 'Manual staging link verification failed.'
}

Write-Host "Manual staging link metadata written for $stagingProjectRef."
