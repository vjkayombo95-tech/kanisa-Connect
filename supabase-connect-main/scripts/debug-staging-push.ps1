[CmdletBinding()]
param()

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputPath = Join-Path $projectRoot 'push-error.txt'

Set-Location $projectRoot
& supabase db push --linked --debug 2>&1 | Tee-Object -FilePath $outputPath
exit $LASTEXITCODE
