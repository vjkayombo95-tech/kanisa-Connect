[CmdletBinding()]
param(
  [string]$TypesOutputPath,
  [switch]$ValidateOutputPathOnly
)

# Local-only disposable schema replay and type generation. Authoritative
# migrations and the reusable prerequisite fixture remain unchanged.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$supabaseRoot = Join-Path $appRoot 'supabase'
$migrationRoot = Join-Path $supabaseRoot 'migrations'
$fixturePath = Join-Path $supabaseRoot 'tests\wave5a_disposable_prereqs.sql'
$canonicalTypesPath = [IO.Path]::GetFullPath((Join-Path $appRoot 'src\integrations\supabase\types.ts'))
$repositoryRoot = $appRoot
$repositoryCursor = [IO.DirectoryInfo]$appRoot
while ($null -ne $repositoryCursor) {
  if (Test-Path -LiteralPath (Join-Path $repositoryCursor.FullName '.git')) {
    $repositoryRoot = $repositoryCursor.FullName
    break
  }
  $repositoryCursor = $repositoryCursor.Parent
}

try {
  if ($PSBoundParameters.ContainsKey('TypesOutputPath') -and [string]::IsNullOrWhiteSpace($TypesOutputPath)) {
    throw 'The generated-types output path cannot be empty or whitespace.'
  }
  $typesPath = if (-not $PSBoundParameters.ContainsKey('TypesOutputPath')) {
    $canonicalTypesPath
  } elseif ([IO.Path]::IsPathRooted($TypesOutputPath)) {
    [IO.Path]::GetFullPath($TypesOutputPath)
  } else {
    [IO.Path]::GetFullPath((Join-Path $appRoot $TypesOutputPath))
  }
} catch {
  throw "Invalid generated-types output path. $($_.Exception.Message)"
}

$repositoryPrefix = $repositoryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$insideRepository = $typesPath.Equals($repositoryRoot, [StringComparison]::OrdinalIgnoreCase) -or $typesPath.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase)
$isCanonicalTypesPath = $typesPath.Equals($canonicalTypesPath, [StringComparison]::OrdinalIgnoreCase)
if ($insideRepository -and -not $isCanonicalTypesPath) {
  throw "Refusing generated-types output inside the repository unless it is the canonical types file: $typesPath"
}
if ($ValidateOutputPathOnly) {
  Write-Output $typesPath
  return
}

$remoteVariables = @('SUPABASE_DB_URL', 'SUPABASE_PRODUCTION_DB_URL', 'SUPABASE_STAGING_DB_URL', 'DATABASE_URL')
$presentRemoteVariables = @($remoteVariables | Where-Object { -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) })
if ($presentRemoteVariables.Count -gt 0) {
  throw "Refusing local replay while remote-capable database variables are present: $($presentRemoteVariables -join ', ')."
}
foreach ($command in @('supabase', 'docker')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Required local command is unavailable: $command" }
}
if (-not (Test-Path -LiteralPath $fixturePath -PathType Leaf)) { throw "Disposable prerequisite fixture is missing: $fixturePath" }

$authoritativeMigrations = @(Get-ChildItem -LiteralPath $migrationRoot -Filter '*.sql' -File | Sort-Object Name)
if ($authoritativeMigrations.Count -eq 0) { throw 'No authoritative migrations were found.' }
$injectedName = '20260622005000_DISPOSABLE_REPLAY_PREREQS.sql'
if ($authoritativeMigrations.Name -notcontains '20260622000000_production_baseline.sql' -or $authoritativeMigrations.Name -notcontains '20260622010000_storage_policies.sql') {
  throw 'The expected baseline/storage migration boundary is missing.'
}
if (Test-Path -LiteralPath (Join-Path $migrationRoot $injectedName)) { throw "Harness-only migration must never exist in the authoritative directory: $injectedName" }

$runId = [Guid]::NewGuid().ToString('N').Substring(0, 10)
$projectId = "kanisareplay$runId"
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) "kanisa-supabase-replay-$runId"
$temporarySupabase = Join-Path $temporaryRoot 'supabase'
$temporaryMigrations = Join-Path $temporarySupabase 'migrations'
$generatedCandidate = Join-Path $temporaryRoot 'types.ts'
$generationErrors = Join-Path $temporaryRoot 'type-generation.stderr.log'
$stackStarted = $false
$completed = $false

function Invoke-Checked {
  param([Parameter(Mandatory)][string]$Command, [Parameter(Mandatory)][string[]]$Arguments, [switch]$Capture)
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $result = & $Command @Arguments 2>&1
    $nativeExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $messages = @($result | ForEach-Object {
    if ($_ -is [Management.Automation.ErrorRecord]) { $_.Exception.Message } else { [string]$_ }
  })
  if ($nativeExitCode -ne 0) { throw "Local command failed: $Command`n$($messages -join [Environment]::NewLine)" }
  if ($Capture) {
    return @($result | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] } | ForEach-Object { [string]$_ })
  }
  $messages | ForEach-Object { Write-Host ([string]$_) }
}

function Invoke-LocalSqlScalar {
  param([Parameter(Mandatory)][string]$Sql)
  $result = Invoke-Checked -Command 'docker' -Arguments @('exec', "supabase_db_$projectId", 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', $Sql) -Capture
  return (($result | Select-Object -Last 1) -as [string]).Trim()
}

try {
  New-Item -ItemType Directory -Path $temporaryMigrations -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $supabaseRoot 'config.toml') -Destination (Join-Path $temporarySupabase 'config.toml')
  foreach ($migration in $authoritativeMigrations) { Copy-Item -LiteralPath $migration.FullName -Destination (Join-Path $temporaryMigrations $migration.Name) }
  $temporaryFixturePath = Join-Path $temporaryMigrations $injectedName
  Copy-Item -LiteralPath $fixturePath -Destination $temporaryFixturePath
  $fixtureText = Get-Content -Raw -LiteralPath $temporaryFixturePath
  $storageRoleMarker = 'set role supabase_admin;'
  $storageRoleOffset = $fixtureText.IndexOf($storageRoleMarker, [StringComparison]::OrdinalIgnoreCase)
  if ($storageRoleOffset -lt 0) { throw 'Disposable fixture no longer contains its expected Storage prerequisite boundary.' }
  $localFixtureText = $fixtureText.Substring(0, $storageRoleOffset) + @'

-- The local Supabase service provisions Storage before migrations. Verify those
-- contracts instead of assuming the migration runner may SET ROLE.
do $$
begin
  if to_regclass('storage.buckets') is null
     or to_regclass('storage.objects') is null
     or to_regprocedure('storage.foldername(text)') is null
     or to_regprocedure('storage.filename(text)') is null then
    raise exception 'Disposable local Supabase Storage prerequisites are unavailable';
  end if;
end $$;
'@
  [IO.File]::WriteAllText($temporaryFixturePath, $localFixtureText, [Text.UTF8Encoding]::new($false))

  $temporaryConfigPath = Join-Path $temporarySupabase 'config.toml'
  $temporaryConfig = Get-Content -Raw -LiteralPath $temporaryConfigPath
  $temporaryConfig = [regex]::Replace($temporaryConfig, '(?m)^project_id\s*=\s*"[^"]*"', "project_id = `"$projectId`"")
  [IO.File]::WriteAllText($temporaryConfigPath, $temporaryConfig, [Text.UTF8Encoding]::new($false))
  if (Test-Path -LiteralPath (Join-Path $temporarySupabase '.temp\project-ref')) { throw 'Remote Supabase link metadata was detected in the disposable project.' }

  Write-Host "Starting disposable local replay project $projectId"
  Invoke-Checked -Command 'supabase' -Arguments @('start', '--workdir', $temporaryRoot) -Capture | Out-Null
  $stackStarted = $true

  $expectedMigrationCount = $authoritativeMigrations.Count + 1
  $ledgerCount = [int](Invoke-LocalSqlScalar 'select count(*) from supabase_migrations.schema_migrations;')
  if ($ledgerCount -ne $expectedMigrationCount) { throw "Migration ledger mismatch: expected $expectedMigrationCount entries, found $ledgerCount." }
  $ledgerFirst = Invoke-LocalSqlScalar 'select min(version) from supabase_migrations.schema_migrations;'
  $ledgerLast = Invoke-LocalSqlScalar 'select max(version) from supabase_migrations.schema_migrations;'

  $bootstrapState = Invoke-LocalSqlScalar @'
with bootstrap_user as (select id from auth.users where lower(email) = 'hauletino55@gmail.com' limit 1)
select concat_ws('|',
  (select count(*) from bootstrap_user),
  (select count(*) from public.super_admins s join bootstrap_user u on to_jsonb(s)->>'id'=u.id::text or to_jsonb(s)->>'user_id'=u.id::text),
  (select count(*) from public.profiles p join bootstrap_user u on p.id=u.id));
'@
  if ($bootstrapState -ne '1|0|0') { throw "Historical bootstrap cleanup did not reach the expected disposable state: $bootstrapState" }

  $contractFailures = Invoke-LocalSqlScalar @'
with checks(name, ok) as (values
 ('prayer privacy', exists(select 1 from information_schema.columns where table_schema='public' and table_name='prayer_requests' and column_name='privacy')),
 ('mass intention payment status', exists(select 1 from information_schema.columns where table_schema='public' and table_name='mass_intentions' and column_name='payment_status')),
 ('bible verse text', exists(select 1 from information_schema.columns where table_schema='public' and table_name='bible_verses' and column_name='verse_text')),
 ('member user identity', exists(select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='user_id')),
 ('assign default member role', to_regprocedure('public.assign_default_member_role(uuid,uuid)') is not null),
 ('notifications', to_regclass('public.notifications') is not null),
 ('radio', to_regclass('public.church_radio_stations') is not null),
 ('livestream', to_regclass('public.church_livestreams') is not null),
 ('ministries', to_regclass('public.ministries') is not null),
 ('storage objects', to_regclass('storage.objects') is not null))
select coalesce(string_agg(name, ', ' order by name) filter (where not ok), '') from checks;
'@
  if (-not [string]::IsNullOrWhiteSpace($contractFailures)) { throw "Critical schema contract verification failed: $contractFailures" }

  $generation = Start-Process -FilePath (Get-Command supabase).Source -ArgumentList @('gen', 'types', '--local', '--schema', 'public', '--workdir', $temporaryRoot) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $generatedCandidate -RedirectStandardError $generationErrors
  if ($generation.ExitCode -ne 0) {
    $safeError = if (Test-Path -LiteralPath $generationErrors) { Get-Content -Raw -LiteralPath $generationErrors } else { '' }
    throw "Local type generation failed with exit code $($generation.ExitCode). $safeError"
  }
  if (-not (Test-Path -LiteralPath $generatedCandidate) -or (Get-Item -LiteralPath $generatedCandidate).Length -eq 0) { throw 'Local type generation produced no output.' }

  $generatedText = Get-Content -Raw -LiteralPath $generatedCandidate
  foreach ($requiredContract in @('prayer_requests:', 'mass_intentions:', 'bible_verses:', 'members:', 'assign_default_member_role:', 'notifications:', 'church_radio_stations:', 'church_livestreams:', 'ministries:')) {
    if (-not $generatedText.Contains($requiredContract)) { throw "Generated types are missing a verified contract: $requiredContract" }
  }
  $typesDirectory = Split-Path -Parent $typesPath
  if (-not (Test-Path -LiteralPath $typesDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $typesDirectory -Force | Out-Null
  }
  Copy-Item -LiteralPath $generatedCandidate -Destination $typesPath -Force
  $completed = $true
  Write-Host "REPLAY_MIGRATION_COUNT=$ledgerCount"
  Write-Host "REPLAY_FIRST=$ledgerFirst"
  Write-Host "REPLAY_LAST=$ledgerLast"
  Write-Host 'BOOTSTRAP_FINAL_STATE=user-present;super-admin-absent;legacy-profile-absent'
  Write-Host "GENERATED_TYPES=$typesPath"
} finally {
  if ($stackStarted) {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & supabase stop --workdir $temporaryRoot --no-backup 2>&1 | ForEach-Object { Write-Host ([string]$_) } } finally { $ErrorActionPreference = $previousErrorActionPreference }
  }
  if (Test-Path -LiteralPath $temporaryRoot) { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force }
  if (-not $completed) { Write-Host 'Disposable replay did not complete; no generated output was installed.' }
}
