-- RC-2.9.4: Event registration roster and actual attendance marking.
-- Keeps registration/payment on event_attendances and adds a separate
-- physical attendance state for event operations.

alter table public.event_attendances
  add column if not exists attendance_status text not null default 'unmarked',
  add column if not exists attendance_marked_at timestamptz,
  add column if not exists attendance_marked_by uuid references auth.users(id) on delete set null;

alter table public.event_attendances
  drop constraint if exists event_attendances_attendance_status_check,
  add constraint event_attendances_attendance_status_check
    check (attendance_status in ('unmarked', 'attended', 'absent'));

create index if not exists idx_event_attendances_event_attendance_status
  on public.event_attendances (event_id, attendance_status);

create or replace function public.can_manage_event_roster(_user_id uuid, _event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = _event_id
      and (
        public.can_manage_church_roles(_user_id, e.church_id)
        or public.can_manage_church_workspace(_user_id, e.church_id)
        or public.is_platform_super_admin(_user_id)
        or public.is_super_admin(_user_id)
      )
  );
$$;

create or replace function public.get_event_registration_roster(p_event_id uuid)
returns table (
  attendance_id uuid,
  event_id uuid,
  church_id uuid,
  event_title text,
  event_start_date timestamptz,
  event_end_date timestamptz,
  event_location text,
  audience_mode text,
  registration_type text,
  registration_fee numeric,
  registration_currency text,
  registration_capacity integer,
  member_id uuid,
  full_name text,
  phone text,
  email text,
  community_names text,
  ministry_names text,
  registration_status text,
  payment_status text,
  registered_at timestamptz,
  attendance_status text,
  amount_due numeric,
  payment_reference text,
  latest_payment_status text,
  expected_revenue numeric,
  verified_revenue numeric,
  pending_verification numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not public.can_manage_event_roster(auth.uid(), p_event_id) then
    raise exception 'You are not authorized to view this event roster.';
  end if;

  return query
  with payment_latest as (
    select distinct on (p.attendance_id)
      p.attendance_id,
      p.transaction_reference,
      p.status
    from public.event_registration_payments p
    where p.event_id = p_event_id
    order by p.attendance_id, p.created_at desc
  ),
  payment_totals as (
    select
      p.event_id,
      coalesce(sum(p.amount) filter (where p.status = 'approved'), 0) as verified_revenue,
      coalesce(sum(p.amount) filter (where p.status = 'pending'), 0) as pending_verification
    from public.event_registration_payments p
    where p.event_id = p_event_id
    group by p.event_id
  )
  select
    ea.id as attendance_id,
    e.id as event_id,
    e.church_id,
    e.title as event_title,
    e.start_date::timestamptz as event_start_date,
    e.end_date::timestamptz as event_end_date,
    e.location as event_location,
    coalesce(e.audience_mode, 'everyone') as audience_mode,
    coalesce(e.registration_type, 'free') as registration_type,
    coalesce(e.registration_fee, 0) as registration_fee,
    coalesce(nullif(e.registration_currency, ''), 'TZS') as registration_currency,
    e.registration_capacity,
    m.id as member_id,
    coalesce(nullif(m.full_name, ''), nullif(pr.full_name, ''), 'Member') as full_name,
    m.phone,
    coalesce(nullif(m.email, ''), au.email) as email,
    nullif(concat_ws(', ',
      legacy_community.name,
      legacy_jumuiya.name,
      community_list.names
    ), '') as community_names,
    nullif(concat_ws(', ',
      legacy_ministry.name,
      ministry_list.names
    ), '') as ministry_names,
    coalesce(ea.registration_status, 'registered') as registration_status,
    coalesce(ea.payment_status, 'not_required') as payment_status,
    coalesce(ea.registered_at, ea.responded_at) as registered_at,
    coalesce(ea.attendance_status, 'unmarked') as attendance_status,
    coalesce(ea.amount_due, 0) as amount_due,
    payment_latest.transaction_reference as payment_reference,
    payment_latest.status as latest_payment_status,
    coalesce(sum(coalesce(ea.amount_due, 0)) filter (
      where coalesce(ea.registration_status, 'registered') not in ('cancelled', 'refunded')
        and coalesce(ea.payment_status, 'not_required') <> 'refunded'
    ) over (partition by ea.event_id), 0) as expected_revenue,
    coalesce(payment_totals.verified_revenue, 0) as verified_revenue,
    coalesce(payment_totals.pending_verification, 0) as pending_verification
  from public.event_attendances ea
  join public.events e on e.id = ea.event_id and e.id = p_event_id
  join public.members m on m.id = ea.member_id and m.church_id = ea.church_id
  left join public.profiles pr on pr.id = m.user_id
  left join auth.users au on au.id = m.user_id
  left join public.communities legacy_community on legacy_community.id = m.community_id
  left join public.communities legacy_jumuiya on legacy_jumuiya.id = m.jumuiya_id and legacy_jumuiya.id is distinct from m.community_id
  left join public.ministries legacy_ministry on legacy_ministry.id = m.ministry_id
  left join lateral (
    select string_agg(distinct c.name, ', ' order by c.name) as names
    from public.member_communities mc
    join public.communities c on c.id = mc.community_id
    where mc.member_id = m.id
      and c.id is distinct from m.community_id
      and c.id is distinct from m.jumuiya_id
  ) community_list on true
  left join lateral (
    select string_agg(distinct mn.name, ', ' order by mn.name) as names
    from public.member_ministries mm
    join public.ministries mn on mn.id = mm.ministry_id
    where mm.member_id = m.id
      and mn.id is distinct from m.ministry_id
  ) ministry_list on true
  left join payment_latest on payment_latest.attendance_id = ea.id
  left join payment_totals on payment_totals.event_id = e.id
  where ea.response = 'yes'
  order by full_name asc, ea.registered_at asc;
end;
$$;

create or replace function public.mark_event_registration_attendance(
  p_event_id uuid,
  p_attendance_ids uuid[],
  p_attendance_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required.');
  end if;

  if p_attendance_status not in ('attended', 'absent', 'unmarked') then
    return jsonb_build_object('success', false, 'error', 'Unsupported attendance status.');
  end if;

  if not public.can_manage_event_roster(auth.uid(), p_event_id) then
    return jsonb_build_object('success', false, 'error', 'You are not authorized to mark this event roster.');
  end if;

  update public.event_attendances ea
  set attendance_status = p_attendance_status,
      attendance_marked_at = now(),
      attendance_marked_by = auth.uid(),
      updated_at = now()
  where ea.event_id = p_event_id
    and ea.id = any(coalesce(p_attendance_ids, array[]::uuid[]))
    and ea.church_id = (select e.church_id from public.events e where e.id = p_event_id);

  get diagnostics v_updated = row_count;

  return jsonb_build_object('success', true, 'updated_count', v_updated);
end;
$$;

revoke all on function public.can_manage_event_roster(uuid, uuid) from public;
revoke all on function public.get_event_registration_roster(uuid) from public;
revoke all on function public.mark_event_registration_attendance(uuid, uuid[], text) from public;

grant execute on function public.can_manage_event_roster(uuid, uuid) to authenticated;
grant execute on function public.get_event_registration_roster(uuid) to authenticated;
grant execute on function public.mark_event_registration_attendance(uuid, uuid[], text) to authenticated;
