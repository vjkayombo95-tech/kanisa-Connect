create table if not exists public.system_jobs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null unique,
  description text,
  schedule text,
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  last_duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_jobs enable row level security;

create policy "Super admins can view system jobs"
on public.system_jobs
for select
to authenticated
using (
  public.is_super_admin()
);

grant select
on public.system_jobs
to authenticated;

create index if not exists system_jobs_job_name_idx
on public.system_jobs (job_name);

create index if not exists system_jobs_enabled_idx
on public.system_jobs (enabled);

insert into public.system_jobs (
  job_name,
  description,
  schedule,
  enabled
)
values (
  'Daily Automations',
  'Runs scheduled daily platform automations',
  'Daily',
  true
)
on conflict (job_name) do nothing;
