-- Harden event_requests staff permissions without exposing permission tables
-- through RLS policy expressions. The helper intentionally binds the caller's
-- role and role-permission row to the same church and same nonmember role.

create or replace function public.has_event_request_staff_permission(
  _user_id uuid,
  _church_id uuid,
  _action text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    _user_id is not null
    and _user_id = auth.uid()
    and _church_id is not null
    and _action in ('view', 'edit', 'approve', 'manage')
    and exists (
      select 1
      from public.user_roles ur
      join public.church_role_permissions crp
        on crp.church_id = ur.church_id
       and crp.role = lower(ur.role::text)
      join public.platform_features pf
        on pf.id = crp.feature_id
      join public.church_features cf
        on cf.church_id = ur.church_id
       and cf.feature_id = pf.id
      where ur.user_id = _user_id
        and ur.church_id = _church_id
        and lower(coalesce(ur.role::text, '')) <> 'member'
        and pf.key = 'event_requests'
        and pf.globally_enabled
        and coalesce((to_jsonb(pf) ->> 'staff_available')::boolean, true)
        and cf.enabled
        and not coalesce((to_jsonb(cf) ->> 'locked')::boolean, false)
        and public.has_church_feature_permission(
          _user_id,
          _church_id,
          'event_requests',
          _action
        )
        and case _action
          when 'view' then crp.can_view
          when 'edit' then crp.can_edit
          when 'approve' then crp.can_approve
          when 'manage' then crp.can_manage
          else false
        end
    );
$$;

create or replace function public.enforce_event_request_staff_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_required_action text := 'edit';
begin
  -- Service-role updates are checked by the existing generic feature trigger.
  if current_setting('role', true) = 'service_role' and auth.role() = 'service_role' then
    return new;
  end if;

  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new.church_id is distinct from old.church_id then
    raise exception 'Event request church cannot be changed' using errcode = '42501';
  end if;

  if new.member_id is distinct from old.member_id then
    raise exception 'Event request owner cannot be changed' using errcode = '42501';
  end if;

  if new.request_type is distinct from old.request_type
     or new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.preferred_date is distinct from old.preferred_date
     or new.preferred_start_time is distinct from old.preferred_start_time
     or new.preferred_end_time is distinct from old.preferred_end_time
     or new.location_preference is distinct from old.location_preference
     or new.expected_attendance is distinct from old.expected_attendance
     or new.ministry_id is distinct from old.ministry_id
     or new.community_id is distinct from old.community_id
     or new.description is distinct from old.description
     or new.additional_notes is distinct from old.additional_notes
     or new.requester_name is distinct from old.requester_name
     or new.requester_phone is distinct from old.requester_phone
     or new.contact_phone is distinct from old.contact_phone then
    raise exception 'Event request submitted details cannot be changed by staff review'
      using errcode = '42501';
  end if;

  if new.converted_event_id is distinct from old.converted_event_id
     or new.converted_mass_event_id is distinct from old.converted_mass_event_id
     or new.converted_at is distinct from old.converted_at
     or new.status is distinct from old.status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    v_required_action := 'approve';
  end if;

  if v_required_action = 'approve' then
    if not (
      public.has_event_request_staff_permission(v_actor, old.church_id, 'approve')
      or public.has_event_request_staff_permission(v_actor, old.church_id, 'manage')
    ) then
      raise exception 'Event request approve permission required' using errcode = '42501';
    end if;
  elsif not (
    public.has_event_request_staff_permission(v_actor, old.church_id, 'edit')
    or public.has_event_request_staff_permission(v_actor, old.church_id, 'manage')
  ) then
    raise exception 'Event request edit permission required' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_event_request_staff_update on public.event_requests;
create trigger enforce_event_request_staff_update
before update on public.event_requests
for each row execute function public.enforce_event_request_staff_update();

drop policy if exists "event requests same church" on public.event_requests;
drop policy if exists "Church members can view event requests" on public.event_requests;
drop policy if exists "insert own event request" on public.event_requests;
drop policy if exists "Users manage own requests" on public.event_requests;
drop policy if exists "Church admins can manage event requests" on public.event_requests;
drop policy if exists "Church managers can read event requests" on public.event_requests;
drop policy if exists "Church managers can review event requests" on public.event_requests;
drop policy if exists "tenant feature select" on public.event_requests;
drop policy if exists "tenant feature insert" on public.event_requests;
drop policy if exists "tenant feature delete" on public.event_requests;
drop policy if exists event_requests_staff_select on public.event_requests;
drop policy if exists event_requests_staff_update on public.event_requests;
drop policy if exists "Church staff can read permitted event requests" on public.event_requests;
drop policy if exists "Church staff can review permitted event requests" on public.event_requests;
drop policy if exists "Members can read own event requests" on public.event_requests;
drop policy if exists "Members can create own event requests" on public.event_requests;

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
      and m.user_id = auth.uid()
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
      and m.user_id = auth.uid()
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

create policy "Church staff can read permitted event requests"
on public.event_requests
for select
to authenticated
using (
  public.has_event_request_staff_permission(auth.uid(), church_id, 'view')
  or public.has_event_request_staff_permission(auth.uid(), church_id, 'edit')
  or public.has_event_request_staff_permission(auth.uid(), church_id, 'approve')
  or public.has_event_request_staff_permission(auth.uid(), church_id, 'manage')
);

create policy "Church staff can review permitted event requests"
on public.event_requests
for update
to authenticated
using (
  public.has_event_request_staff_permission(auth.uid(), church_id, 'edit')
  or public.has_event_request_staff_permission(auth.uid(), church_id, 'approve')
  or public.has_event_request_staff_permission(auth.uid(), church_id, 'manage')
)
with check (
  public.has_event_request_staff_permission(auth.uid(), church_id, 'edit')
  or public.has_event_request_staff_permission(auth.uid(), church_id, 'approve')
  or public.has_event_request_staff_permission(auth.uid(), church_id, 'manage')
);

revoke all on function public.has_event_request_staff_permission(uuid, uuid, text) from public, anon;
revoke all on function public.enforce_event_request_staff_update() from public, anon;
grant execute on function public.has_event_request_staff_permission(uuid, uuid, text) to authenticated;


-- Wave23D: manage permission for event_requests
CREATE OR REPLACE FUNCTION public.enforce_feature_mutation_permission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_church_id uuid;
  v_feature text;
  v_action text;
  v_allowed boolean;
begin
  -- Only the service-role JWT and database owner are explicit internal paths.
  if auth.uid() is null and session_user in ('postgres','supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Account bootstrap and self-profile maintenance are record-owned operations,
  -- not tenant member-administration. Existing member RLS still constrains them.
  if tg_table_name = 'members' and auth.uid() is not null
     and tg_op in ('INSERT','UPDATE')
     and nullif(v_row->>'user_id','')::uuid = auth.uid() then
    return new;
  end if;
  if tg_table_name = 'invitations' and tg_op = 'UPDATE'
     and v_old->>'status' = 'pending' and v_row->>'status' = 'accepted'
     and lower(coalesce(v_row->>'email','')) = lower(coalesce(auth.jwt()->>'email','')) then
    return new;
  end if;
  if tg_table_name = 'notifications' and tg_op = 'UPDATE'
     and nullif(v_row->>'user_id','')::uuid = auth.uid() then
    return new;
  end if;
  if tg_table_name = 'notifications' and auth.role() = 'service_role'
     and nullif(v_row->>'church_id','') is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_church_id := nullif(v_row->>'church_id','')::uuid;
  if v_church_id is null and tg_table_name = 'pledge_payments' then
    select p.church_id into v_church_id
    from public.pledges p where p.id = nullif(v_row->>'pledge_id','')::uuid;
  elsif v_church_id is null and tg_table_name = 'event_attendances' then
    select e.church_id into v_church_id
    from public.events e where e.id = nullif(v_row->>'event_id','')::uuid;
  elsif v_church_id is null and tg_table_name = 'member_ministries' then
    select m.church_id into v_church_id
    from public.ministries m where m.id = nullif(v_row->>'ministry_id','')::uuid;
  elsif v_church_id is null and tg_table_name = 'member_communities' then
    select c.church_id into v_church_id
    from public.communities c where c.id = nullif(v_row->>'community_id','')::uuid;
  elsif v_church_id is null and tg_table_name = 'mass_responses' then
    select me.church_id into v_church_id
    from public.mass_events me where me.id = nullif(v_row->>'mass_event_id','')::uuid;
  elsif v_church_id is null and tg_table_name in ('help_comments','help_donations') then
    select h.church_id into v_church_id
    from public.community_help_requests h where h.id = nullif(v_row->>'help_request_id','')::uuid;
  end if;
  v_feature := case tg_table_name
    when 'community_help_requests' then 'community_help'
    when 'event_attendances' then 'events'
    when 'event_registration_payments' then 'events'
    when 'pledge_payments' then 'pledges'
    when 'invitations' then 'roles'
    when 'member_ministries' then 'ministries'
    when 'ministry_join_requests' then 'ministries'
    when 'member_communities' then 'communities'
    when 'event_audience_targets' then 'events'
    when 'mass_events' then 'events'
    when 'mass_responses' then 'events'
    when 'sacramental_records' then 'sacraments'
    when 'community_targets' then 'pledges'
    when 'contribution_categories' then 'contributions'
    when 'help_comments' then 'community_help'
    when 'help_donations' then 'community_help'
    when 'messages' then 'notifications'
    when 'prayer_request_comments' then 'prayer_requests'
    when 'prayer_request_prayers' then 'prayer_requests'
    else tg_table_name end;
  v_action := case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'edit' end;
  if tg_op = 'UPDATE' and tg_table_name = 'announcements'
     and (v_old->>'status' is distinct from v_row->>'status' or v_old->>'is_published' is distinct from v_row->>'is_published') then
    v_action := 'publish';
  elsif tg_op = 'UPDATE' and tg_table_name = 'messages'
     and v_old->>'status' is distinct from v_row->>'status' then
    v_action := 'publish';
  elsif tg_op = 'UPDATE' and tg_table_name in ('prayer_requests','mass_intentions','event_registration_payments')
     and v_old->>'status' is distinct from v_row->>'status' then
    v_action := 'approve';
  elsif tg_op = 'UPDATE' and tg_table_name in ('event_requests','ministry_join_requests')
     and v_old->>'status' is distinct from v_row->>'status' then
    v_action := 'approve';
  elsif tg_op = 'UPDATE' and tg_table_name = 'pledge_payments'
     and v_old->>'verification_status' is distinct from v_row->>'verification_status' then
    v_action := 'approve';
  end if;
  v_allowed := case when auth.role() = 'service_role'
    then public.is_service_feature_available(v_church_id, v_feature)
    else public.has_church_feature_permission(auth.uid(), v_church_id, v_feature, v_action)
  end;
  if tg_table_name = 'event_requests'
     and tg_op = 'UPDATE'
     and auth.role() <> 'service_role'
     and v_action in ('edit', 'approve')
     and not coalesce(v_allowed, false) then
    v_allowed := public.has_event_request_staff_permission(
      auth.uid(), v_church_id, 'manage'
    );
  end if;

  if v_church_id is null or not coalesce(v_allowed, false) then
    raise exception 'Missing % permission for feature %', v_action, v_feature using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;
