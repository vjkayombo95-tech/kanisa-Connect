-- V1.1 Phase 1: Mass RSVP / Expected Attendance
-- Lightweight attendance forecast only. This does not implement check-in or attendance marking.

create table if not exists public.mass_events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  title text not null,
  description text,
  mass_date date not null,
  start_time time not null,
  end_time time,
  response_deadline timestamptz,
  ask_for_rsvp boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mass_responses (
  id uuid primary key default gen_random_uuid(),
  mass_event_id uuid not null references public.mass_events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  response text not null check (response in ('yes', 'maybe', 'no')),
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mass_event_id, member_id)
);

create index if not exists mass_events_church_date_idx
on public.mass_events (church_id, mass_date, start_time);

create index if not exists mass_events_active_upcoming_idx
on public.mass_events (church_id, is_active, mass_date, start_time);

create index if not exists mass_responses_event_response_idx
on public.mass_responses (mass_event_id, response);

create index if not exists mass_responses_member_idx
on public.mass_responses (member_id);

drop trigger if exists update_mass_events_updated_at on public.mass_events;
create trigger update_mass_events_updated_at
before update on public.mass_events
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_mass_responses_updated_at on public.mass_responses;
create trigger update_mass_responses_updated_at
before update on public.mass_responses
for each row
execute function public.update_updated_at_column();

alter table public.mass_events enable row level security;
alter table public.mass_responses enable row level security;

drop policy if exists "Church admins can manage mass events" on public.mass_events;
create policy "Church admins can manage mass events"
on public.mass_events
for all
to authenticated
using (
  public.is_church_admin(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
)
with check (
  public.is_church_admin(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
);

drop policy if exists "Members can read upcoming mass events" on public.mass_events;
create policy "Members can read upcoming mass events"
on public.mass_events
for select
to authenticated
using (
  is_active = true
  and mass_date >= current_date
  and public.is_church_member(auth.uid(), church_id)
);

drop policy if exists "Church admins can view mass responses" on public.mass_responses;
create policy "Church admins can view mass responses"
on public.mass_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.mass_events me
    where me.id = mass_responses.mass_event_id
      and (
        public.is_church_admin(auth.uid(), me.church_id)
        or public.is_super_admin(auth.uid())
      )
  )
);

drop policy if exists "Members can view own mass responses" on public.mass_responses;
create policy "Members can view own mass responses"
on public.mass_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    join public.mass_events me on me.id = mass_responses.mass_event_id
    where m.id = mass_responses.member_id
      and m.user_id = auth.uid()
      and m.church_id = me.church_id
  )
);

drop policy if exists "Members can create own mass responses" on public.mass_responses;
create policy "Members can create own mass responses"
on public.mass_responses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.members m
    join public.mass_events me on me.id = mass_responses.mass_event_id
    where m.id = mass_responses.member_id
      and m.user_id = auth.uid()
      and m.church_id = me.church_id
      and me.is_active = true
      and me.ask_for_rsvp = true
      and (me.response_deadline is null or now() <= me.response_deadline)
  )
);

drop policy if exists "Members can update own mass responses" on public.mass_responses;
create policy "Members can update own mass responses"
on public.mass_responses
for update
to authenticated
using (
  exists (
    select 1
    from public.members m
    join public.mass_events me on me.id = mass_responses.mass_event_id
    where m.id = mass_responses.member_id
      and m.user_id = auth.uid()
      and m.church_id = me.church_id
      and me.is_active = true
      and me.ask_for_rsvp = true
      and (me.response_deadline is null or now() <= me.response_deadline)
  )
)
with check (
  exists (
    select 1
    from public.members m
    join public.mass_events me on me.id = mass_responses.mass_event_id
    where m.id = mass_responses.member_id
      and m.user_id = auth.uid()
      and m.church_id = me.church_id
      and me.is_active = true
      and me.ask_for_rsvp = true
      and (me.response_deadline is null or now() <= me.response_deadline)
  )
);

create or replace function public.submit_mass_response(
  p_mass_event_id uuid,
  p_member_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.mass_events%rowtype;
  v_member public.members%rowtype;
  v_yes_count integer := 0;
  v_maybe_count integer := 0;
  v_no_count integer := 0;
  v_total_members integer := 0;
  v_response_rate numeric := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if p_response not in ('yes', 'maybe', 'no') then
    return jsonb_build_object('success', false, 'error', 'Invalid response');
  end if;

  select *
  into v_event
  from public.mass_events
  where id = p_mass_event_id
  for update;

  if v_event.id is null then
    return jsonb_build_object('success', false, 'error', 'Mass was not found');
  end if;

  if not v_event.is_active or not v_event.ask_for_rsvp then
    return jsonb_build_object('success', false, 'error', 'RSVP is not open for this Mass');
  end if;

  if v_event.response_deadline is not null and now() > v_event.response_deadline then
    return jsonb_build_object('success', false, 'error', 'The RSVP deadline has passed');
  end if;

  select *
  into v_member
  from public.members
  where id = p_member_id
    and user_id = v_user_id
    and church_id = v_event.church_id
  limit 1;

  if v_member.id is null then
    return jsonb_build_object('success', false, 'error', 'You can only RSVP for your own member record');
  end if;

  insert into public.mass_responses (
    mass_event_id,
    member_id,
    response,
    responded_at,
    updated_at
  )
  values (
    p_mass_event_id,
    p_member_id,
    p_response,
    now(),
    now()
  )
  on conflict (mass_event_id, member_id)
  do update set
    response = excluded.response,
    responded_at = now(),
    updated_at = now();

  select
    count(*) filter (where response = 'yes'),
    count(*) filter (where response = 'maybe'),
    count(*) filter (where response = 'no')
  into v_yes_count, v_maybe_count, v_no_count
  from public.mass_responses
  where mass_event_id = p_mass_event_id;

  select count(*)
  into v_total_members
  from public.members
  where church_id = v_event.church_id
    and coalesce(status, 'active') = 'active';

  if v_total_members > 0 then
    v_response_rate := round(((v_yes_count + v_maybe_count + v_no_count)::numeric / v_total_members::numeric) * 100, 2);
  end if;

  return jsonb_build_object(
    'success', true,
    'mass_event_id', p_mass_event_id,
    'response', p_response,
    'yes_count', v_yes_count,
    'maybe_count', v_maybe_count,
    'no_count', v_no_count,
    'response_rate', v_response_rate
  );
end;
$$;

create or replace function public.get_next_mass_summary(p_church_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_church_id uuid := p_church_id;
  v_event public.mass_events%rowtype;
  v_member_id uuid;
  v_my_response text;
  v_yes_count integer := 0;
  v_maybe_count integer := 0;
  v_no_count integer := 0;
  v_total_members integer := 0;
  v_response_rate numeric := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if v_church_id is null then
    select m.church_id
    into v_church_id
    from public.members m
    where m.user_id = v_user_id
    limit 1;
  end if;

  if v_church_id is null then
    return jsonb_build_object('success', true, 'mass', null);
  end if;

  if not (
    public.is_church_member(v_user_id, v_church_id)
    or public.is_church_admin(v_user_id, v_church_id)
    or public.is_super_admin(v_user_id)
  ) then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;

  select *
  into v_event
  from public.mass_events
  where church_id = v_church_id
    and is_active = true
    and mass_date >= current_date
  order by mass_date asc, start_time asc
  limit 1;

  if v_event.id is null then
    return jsonb_build_object('success', true, 'mass', null);
  end if;

  select
    count(*) filter (where response = 'yes'),
    count(*) filter (where response = 'maybe'),
    count(*) filter (where response = 'no')
  into v_yes_count, v_maybe_count, v_no_count
  from public.mass_responses
  where mass_event_id = v_event.id;

  select count(*)
  into v_total_members
  from public.members
  where church_id = v_church_id
    and coalesce(status, 'active') = 'active';

  select m.id
  into v_member_id
  from public.members m
  where m.user_id = v_user_id
    and m.church_id = v_church_id
  limit 1;

  if v_member_id is not null then
    select mr.response
    into v_my_response
    from public.mass_responses mr
    where mr.mass_event_id = v_event.id
      and mr.member_id = v_member_id
    limit 1;
  end if;

  if v_total_members > 0 then
    v_response_rate := round(((v_yes_count + v_maybe_count + v_no_count)::numeric / v_total_members::numeric) * 100, 2);
  end if;

  return jsonb_build_object(
    'success', true,
    'mass', jsonb_build_object(
      'id', v_event.id,
      'church_id', v_event.church_id,
      'title', v_event.title,
      'description', v_event.description,
      'mass_date', v_event.mass_date,
      'start_time', v_event.start_time,
      'end_time', v_event.end_time,
      'response_deadline', v_event.response_deadline,
      'ask_for_rsvp', v_event.ask_for_rsvp,
      'is_active', v_event.is_active,
      'my_member_id', v_member_id,
      'my_response', v_my_response
    ),
    'yes_count', v_yes_count,
    'maybe_count', v_maybe_count,
    'no_count', v_no_count,
    'response_rate', v_response_rate
  );
end;
$$;

create or replace function public.notify_mass_rsvp_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.notifications (
    user_id,
    church_id,
    title,
    message,
    type
  )
  select
    m.user_id,
    me.church_id,
    'Mass RSVP reminder',
    'Please let your church know whether you expect to attend ' || me.title || ' on ' || to_char(me.mass_date, 'DD Mon YYYY') || '.',
    'info'
  from public.mass_events me
  join public.members m on m.church_id = me.church_id
  where me.is_active = true
    and me.ask_for_rsvp = true
    and me.mass_date = current_date + 1
    and m.user_id is not null
    and coalesce(m.status, 'active') = 'active'
    and not exists (
      select 1
      from public.mass_responses mr
      where mr.mass_event_id = me.id
        and mr.member_id = m.id
    )
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = m.user_id
        and n.church_id = me.church_id
        and n.title = 'Mass RSVP reminder'
        and n.message = 'Please let your church know whether you expect to attend ' || me.title || ' on ' || to_char(me.mass_date, 'DD Mon YYYY') || '.'
        and n.created_at >= now() - interval '24 hours'
    );

  get diagnostics v_inserted = row_count;

  return jsonb_build_object('success', true, 'notifications_created', v_inserted);
end;
$$;

grant select, insert, update
on public.mass_events
to authenticated;

grant select, insert, update
on public.mass_responses
to authenticated;

grant execute on function public.submit_mass_response(uuid, uuid, text) to authenticated;
grant execute on function public.get_next_mass_summary(uuid) to authenticated;
revoke all on function public.notify_mass_rsvp_reminders() from public;
revoke all on function public.notify_mass_rsvp_reminders() from authenticated;
