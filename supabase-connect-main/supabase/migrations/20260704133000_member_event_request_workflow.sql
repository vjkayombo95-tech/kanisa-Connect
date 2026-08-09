-- RC-2.7.8: Member Event Requests and Church Admin approval workflow.
-- Additive convergence for the existing public.event_requests table.

alter table public.event_requests
  add column if not exists title text,
  add column if not exists preferred_start_time time,
  add column if not exists preferred_end_time time,
  add column if not exists location_preference text,
  add column if not exists expected_attendance integer,
  add column if not exists ministry_id uuid references public.ministries(id) on delete set null,
  add column if not exists community_id uuid references public.communities(id) on delete set null,
  add column if not exists additional_notes text,
  add column if not exists admin_notes text,
  add column if not exists converted_event_id uuid references public.events(id) on delete set null,
  add column if not exists converted_mass_event_id uuid references public.mass_events(id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.event_requests
set
  request_type = case
    when request_type in ('wedding', 'baptism', 'funeral') then 'parish_event'
    when request_type is null and type in ('wedding', 'baptism', 'funeral') then 'parish_event'
    when request_type is null then 'other'
    else request_type
  end,
  status = case
    when status = 'pending' then 'submitted'
    when status = 'completed' then 'converted'
    when status is null then 'submitted'
    else status
  end,
  title = coalesce(nullif(trim(title), ''), nullif(trim(type), ''), nullif(trim(request_type), ''), 'Event request'),
  updated_at = coalesce(updated_at, now());

alter table public.event_requests
  drop constraint if exists event_requests_request_type_check,
  add constraint event_requests_request_type_check
    check (request_type in (
      'parish_event',
      'ministry_group_event',
      'special_mass_request',
      'venue_facility_request',
      'prayer_formation_event',
      'other'
    ));

alter table public.event_requests
  drop constraint if exists event_requests_status_check,
  add constraint event_requests_status_check
    check (status in (
      'draft',
      'submitted',
      'under_review',
      'changes_requested',
      'approved',
      'rejected',
      'converted',
      'scheduled',
      'cancelled'
    ));

alter table public.event_requests
  drop constraint if exists event_requests_expected_attendance_check,
  add constraint event_requests_expected_attendance_check
    check (expected_attendance is null or expected_attendance >= 0);

alter table public.event_requests
  drop constraint if exists event_requests_one_conversion_target_check,
  add constraint event_requests_one_conversion_target_check
    check (converted_event_id is null or converted_mass_event_id is null);

create index if not exists idx_event_requests_church_status_created
  on public.event_requests (church_id, status, created_at desc);

create index if not exists idx_event_requests_member_created
  on public.event_requests (member_id, created_at desc);

create index if not exists idx_event_requests_church_type_date
  on public.event_requests (church_id, request_type, preferred_date);

create index if not exists idx_event_requests_converted_event
  on public.event_requests (converted_event_id)
  where converted_event_id is not null;

create index if not exists idx_event_requests_converted_mass_event
  on public.event_requests (converted_mass_event_id)
  where converted_mass_event_id is not null;

create or replace function public.set_event_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_requests_updated_at on public.event_requests;
create trigger set_event_requests_updated_at
before update on public.event_requests
for each row execute function public.set_event_requests_updated_at();

drop policy if exists "event requests same church" on public.event_requests;
drop policy if exists "insert own event request" on public.event_requests;
drop policy if exists "Users manage own requests" on public.event_requests;
drop policy if exists "Church admins can manage event requests" on public.event_requests;
drop policy if exists "Members can read own event requests" on public.event_requests;
drop policy if exists "Members can create own event requests" on public.event_requests;
drop policy if exists "Church managers can read event requests" on public.event_requests;
drop policy if exists "Church managers can review event requests" on public.event_requests;

create policy "Members can read own event requests"
on public.event_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = event_requests.member_id
      and m.church_id = event_requests.church_id
      and (
        m.user_id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "Members can create own event requests"
on public.event_requests
for insert
to authenticated
with check (
  status in ('draft', 'submitted')
  and reviewed_by is null
  and reviewed_at is null
  and admin_notes is null
  and converted_event_id is null
  and converted_mass_event_id is null
  and converted_at is null
  and exists (
    select 1
    from public.members m
    where m.id = event_requests.member_id
      and m.church_id = event_requests.church_id
      and (
        m.user_id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
  and (
    ministry_id is null
    or exists (
      select 1
      from public.member_ministries mm
      join public.ministries ministry on ministry.id = mm.ministry_id
      where mm.member_id = event_requests.member_id
        and mm.ministry_id = event_requests.ministry_id
        and ministry.church_id = event_requests.church_id
    )
  )
  and (
    community_id is null
    or exists (
      select 1
      from public.member_communities mc
      join public.communities community on community.id = mc.community_id
      where mc.member_id = event_requests.member_id
        and mc.community_id = event_requests.community_id
        and community.church_id = event_requests.church_id
    )
  )
);

create policy "Church managers can read event requests"
on public.event_requests
for select
to authenticated
using (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
);

create policy "Church managers can review event requests"
on public.event_requests
for update
to authenticated
using (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
)
with check (
  church_id is not null
  and public.can_manage_church_roles(auth.uid(), church_id)
);

grant select, insert, update on public.event_requests to authenticated;
