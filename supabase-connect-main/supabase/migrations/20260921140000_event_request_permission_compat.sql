-- Make event request staff RLS compatible with both legacy Production
-- and the newer tenant feature-permission schema.
-- Feature availability is enforced by has_church_feature_permission().
-- Explicit role permissions remain required below.

drop policy if exists "Church staff can read permitted event requests" on public.event_requests;
drop policy if exists "Church staff can review permitted event requests" on public.event_requests;
drop policy if exists event_requests_staff_select on public.event_requests;
drop policy if exists event_requests_staff_update on public.event_requests;

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
      and crp.can_edit
  )
);
