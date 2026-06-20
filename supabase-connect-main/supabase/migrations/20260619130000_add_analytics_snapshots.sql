create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  snapshot_type text not null default 'monthly_overview',
  period_start timestamptz not null,
  period_end timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now()
);

alter table public.analytics_snapshots enable row level security;

create index if not exists idx_analytics_snapshots_church_type_generated
  on public.analytics_snapshots(church_id, snapshot_type, generated_at desc);

drop policy if exists "Church members can read analytics snapshots" on public.analytics_snapshots;
create policy "Church members can read analytics snapshots"
on public.analytics_snapshots
for select
using (
  exists (
    select 1
    from public.members m
    where m.church_id = analytics_snapshots.church_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Church admins can create analytics snapshots" on public.analytics_snapshots;
create policy "Church admins can create analytics snapshots"
on public.analytics_snapshots
for insert
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.church_id = analytics_snapshots.church_id
      and ur.user_id = auth.uid()
      and ur.role in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
  )
);
