-- Kanisa Connect RC-2.1.0: Daily Readings on Catholic CMS.
-- This is additive. Legacy liturgical_days/daily_readings remain available
-- as fallback until CMS-backed readings are fully verified in production.

create table if not exists public.content_daily_readings (
  id uuid primary key default gen_random_uuid(),
  reading_date date not null,
  liturgical_year text not null default '',
  liturgical_season text not null default '',
  celebration text not null default '',
  liturgical_color text not null default '',
  first_reading_reference text not null default '',
  responsorial_psalm_reference text not null default '',
  second_reading_reference text,
  gospel_acclamation_reference text,
  gospel_reference text not null default '',
  reflection text,
  prayer text,
  meditation_questions text,
  daily_challenge text,
  language_id uuid references public.content_languages(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'featured', 'archived')),
  visibility text not null default 'member'
    check (visibility in ('public', 'member', 'pastoral', 'admin')),
  source_attribution text,
  editorial_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reading_date, language_id)
);

create index if not exists idx_content_daily_readings_date on public.content_daily_readings(reading_date);
create index if not exists idx_content_daily_readings_status on public.content_daily_readings(status);
create index if not exists idx_content_daily_readings_language on public.content_daily_readings(language_id);
create index if not exists idx_content_daily_readings_year on public.content_daily_readings(liturgical_year);
create index if not exists idx_content_daily_readings_search
  on public.content_daily_readings using gin (
    to_tsvector('english',
      coalesce(celebration, '') || ' ' ||
      coalesce(liturgical_season, '') || ' ' ||
      coalesce(first_reading_reference, '') || ' ' ||
      coalesce(responsorial_psalm_reference, '') || ' ' ||
      coalesce(second_reading_reference, '') || ' ' ||
      coalesce(gospel_acclamation_reference, '') || ' ' ||
      coalesce(gospel_reference, '') || ' ' ||
      coalesce(reflection, '') || ' ' ||
      coalesce(prayer, '')
    )
  );

drop trigger if exists set_content_daily_readings_updated_at on public.content_daily_readings;
create trigger set_content_daily_readings_updated_at
before update on public.content_daily_readings
for each row execute function public.set_updated_at();

create or replace function public.capture_content_daily_reading_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next
  from public.content_versions
  where content_type = 'daily_reading'
    and content_id = new.id;

  insert into public.content_versions (content_type, content_id, version_number, snapshot, created_by)
  values ('daily_reading', new.id, v_next, to_jsonb(new), auth.uid());

  return new;
end;
$$;

drop trigger if exists capture_content_daily_reading_version on public.content_daily_readings;
create trigger capture_content_daily_reading_version
after insert or update on public.content_daily_readings
for each row execute function public.capture_content_daily_reading_version();

-- Relationship targets need to support references such as Scripture strings and
-- date keys in addition to UUID-backed CMS records.
alter table public.content_relationships
  alter column target_id drop not null,
  add column if not exists target_key text,
  add column if not exists target_label text;

alter table public.content_daily_readings enable row level security;

drop policy if exists "Authenticated users can read published CMS daily readings" on public.content_daily_readings;
create policy "Authenticated users can read published CMS daily readings"
on public.content_daily_readings for select to authenticated
using (
  status in ('published', 'featured')
  or public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
);

drop policy if exists "Super admins manage CMS daily readings" on public.content_daily_readings;
create policy "Super admins manage CMS daily readings"
on public.content_daily_readings for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

grant select, insert, update, delete on public.content_daily_readings to authenticated;
