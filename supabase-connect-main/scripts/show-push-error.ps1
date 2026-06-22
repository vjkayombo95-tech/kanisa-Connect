[CmdletBinding()]
param()

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputPath = Join-Path $projectRoot 'push-error.txt'

if (-not (Test-Path -LiteralPath $outputPath)) {
  throw "No push-error.txt found. Run .\scripts\debug-staging-push.ps1 first."
}

Select-String -LiteralPath $outputPath -Pattern 'Applying migration|ERROR|SQLSTATE|At statement' |
  ForEach-Object { $_.Line }
