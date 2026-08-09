-- Audio review and approval workflow.

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'audio_reviews'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.audio_reviews drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.audio_reviews
add constraint audio_reviews_status_check
check (status in ('pending', 'approved', 'rejected', 'needs_reprocessing', 'changes_requested'));

create table if not exists public.audio_verse_reviews (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  job_id uuid not null references public.audio_jobs(id) on delete cascade,
  review_id uuid references public.audio_reviews(id) on delete cascade,
  verse_number integer not null check (verse_number > 0),
  verse_text text not null default '',
  start_time numeric(12,3) not null default 0,
  end_time numeric(12,3) not null default 0,
  duration numeric(12,3) not null default 0,
  confidence numeric(6,5) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'flagged', 'edited')),
  notes text,
  manually_edited boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, verse_number)
);

create table if not exists public.audio_review_audit (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  job_id uuid not null references public.audio_jobs(id) on delete cascade,
  review_id uuid references public.audio_reviews(id) on delete set null,
  verse_review_id uuid references public.audio_verse_reviews(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audio_version_verses (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  version_id uuid not null references public.audio_versions(id) on delete cascade,
  job_id uuid not null references public.audio_jobs(id) on delete cascade,
  verse_number integer not null check (verse_number > 0),
  verse_text text not null default '',
  start_time numeric(12,3) not null default 0,
  end_time numeric(12,3) not null default 0,
  duration numeric(12,3) not null default 0,
  confidence numeric(6,5) not null default 0,
  notes text,
  manually_edited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (version_id, verse_number)
);

create index if not exists idx_audio_verse_reviews_job on public.audio_verse_reviews (job_id, verse_number);
create index if not exists idx_audio_review_audit_job on public.audio_review_audit (job_id, created_at desc);
create index if not exists idx_audio_version_verses_version on public.audio_version_verses (version_id, verse_number);

drop trigger if exists update_audio_verse_reviews_updated_at on public.audio_verse_reviews;
create trigger update_audio_verse_reviews_updated_at
before update on public.audio_verse_reviews
for each row execute function public.update_updated_at_column();

alter table public.audio_verse_reviews enable row level security;
alter table public.audio_review_audit enable row level security;
alter table public.audio_version_verses enable row level security;

drop policy if exists "Church admins can read audio verse reviews" on public.audio_verse_reviews;
create policy "Church admins can read audio verse reviews"
on public.audio_verse_reviews for select to authenticated
using (public.can_view_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio verse reviews" on public.audio_verse_reviews;
create policy "Church admins can manage audio verse reviews"
on public.audio_verse_reviews for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can read audio review audit" on public.audio_review_audit;
create policy "Church admins can read audio review audit"
on public.audio_review_audit for select to authenticated
using (public.can_view_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio review audit" on public.audio_review_audit;
create policy "Church admins can manage audio review audit"
on public.audio_review_audit for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can read audio version verses" on public.audio_version_verses;
create policy "Church admins can read audio version verses"
on public.audio_version_verses for select to authenticated
using (public.can_view_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio version verses" on public.audio_version_verses;
create policy "Church admins can manage audio version verses"
on public.audio_version_verses for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

grant select, insert, update, delete on public.audio_verse_reviews to authenticated;
grant select, insert, update, delete on public.audio_review_audit to authenticated;
grant select, insert, update, delete on public.audio_version_verses to authenticated;
