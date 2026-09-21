-- Align event request staff RLS with the tenant feature permission model.
-- Members retain their existing owner-scoped SELECT/INSERT policies.
-- Staff read access requires event_requests:view.
-- Staff review/update access requires event_requests:edit.

drop policy if exists "Church managers can read event requests" on public.event_requests;
drop policy if exists "Church managers can review event requests" on public.event_requests;
drop policy if exists "event requests same church" on public.event_requests;
drop policy if exists "Church members can view event requests" on public.event_requests;
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
  church_id is not null
  and public.has_church_feature_permission(
    auth.uid(),
    church_id,
    'event_requests',
    'view'
  )
  and exists (
    select 1
    from public.user_roles ur
    join public.church_role_permissions crp
      on crp.church_id = ur.church_id
     and crp.role = lower(ur.role::text)
    join public.platform_features pf
      on pf.id = crp.feature_id
    where ur.user_id = auth.uid()
      and ur.church_id = event_requests.church_id
      and lower(coalesce(ur.role::text, '')) <> 'member'
      and pf.key = 'event_requests'
      and pf.staff_available
      and crp.can_view
  )
);

create policy "Church staff can review permitted event requests"
on public.event_requests
for update
to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(
    auth.uid(),
    church_id,
    'event_requests',
    'edit'
  )
  and exists (
    select 1
    from public.user_roles ur
    join public.church_role_permissions crp
      on crp.church_id = ur.church_id
     and crp.role = lower(ur.role::text)
    join public.platform_features pf
      on pf.id = crp.feature_id
    where ur.user_id = auth.uid()
      and ur.church_id = event_requests.church_id
      and lower(coalesce(ur.role::text, '')) <> 'member'
      and pf.key = 'event_requests'
      and pf.staff_available
      and crp.can_edit
  )
)
with check (
  church_id is not null
  and public.has_church_feature_permission(
    auth.uid(),
    church_id,
    'event_requests',
    'edit'
  )
  and exists (
    select 1
    from public.user_roles ur
    join public.church_role_permissions crp
      on crp.church_id = ur.church_id
     and crp.role = lower(ur.role::text)
    join public.platform_features pf
      on pf.id = crp.feature_id
    where ur.user_id = auth.uid()
      and ur.church_id = event_requests.church_id
      and lower(coalesce(ur.role::text, '')) <> 'member'
      and pf.key = 'event_requests'
      and pf.staff_available
      and crp.can_edit
  )
);
