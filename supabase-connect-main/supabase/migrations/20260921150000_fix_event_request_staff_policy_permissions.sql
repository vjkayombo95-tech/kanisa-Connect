-- Production hotfix: avoid direct permission-table reads in event_requests RLS.
--
-- Production has authenticated SELECT on user_roles, but not on
-- church_role_permissions. Keep member policies unchanged and move role
-- permission evaluation behind the existing SECURITY DEFINER
-- has_church_feature_permission(uuid, uuid, text, text) helper.
--
-- Deployment note: this migration is intentionally ordered after
-- 20260921140000_event_request_permission_compat.sql and before the
-- incompatible, currently undeployed 20260922120000 Wave 23D migration. Do
-- not deploy by applying all pending migrations while Wave 23D remains pending.

drop policy if exists "Church staff can read permitted event requests"
on public.event_requests;

drop policy if exists "Church staff can review permitted event requests"
on public.event_requests;

create policy "Church staff can read permitted event requests"
on public.event_requests
for select
to authenticated
using (
  church_id is not null
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = event_requests.church_id
      and lower(coalesce(ur.role::text, '')) <> 'member'
  )
  and public.has_church_feature_permission(
    auth.uid(),
    church_id,
    'event_requests',
    'view'
  )
);

create policy "Church staff can review permitted event requests"
on public.event_requests
for update
to authenticated
using (
  church_id is not null
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = event_requests.church_id
      and lower(coalesce(ur.role::text, '')) <> 'member'
  )
  and public.has_church_feature_permission(
    auth.uid(),
    church_id,
    'event_requests',
    'edit'
  )
)
with check (
  church_id is not null
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = event_requests.church_id
      and lower(coalesce(ur.role::text, '')) <> 'member'
  )
  and public.has_church_feature_permission(
    auth.uid(),
    church_id,
    'event_requests',
    'edit'
  )
);
