-- Add consumption-only access for existing same-church staff. The canonical
-- future-church provisioner already derives view access from staff_available.
-- All mutation and management columns deliberately remain false/unchanged.
insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
  can_approve, can_publish, can_manage
)
select c.id, r.role, pf.id, true, false, false, false, false, false, false
from public.churches c
join public.platform_features pf on pf.key in ('livestream', 'radio')
cross join unnest(array['pastor', 'secretary', 'treasurer']) r(role)
on conflict (church_id, role, feature_id) do update set
  can_view = true;
