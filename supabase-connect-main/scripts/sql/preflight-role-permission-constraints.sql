-- Read-only preflight for 20260727120000_enforce_role_permission_constraints.sql.
-- Run only after the migration functions exist. This script never mutates data.

with assigned_permissions as (
  select
    crp.church_id,
    c.name as church_name,
    crp.role,
    pf.key as feature_key,
    action_map.action,
    action_map.granted,
    public.church_permission_constraint_rule(crp.role, pf.key, action_map.action) as rule
  from public.church_role_permissions crp
  join public.churches c on c.id = crp.church_id
  join public.platform_features pf on pf.id = crp.feature_id
  cross join lateral (values
    ('view', crp.can_view),
    ('create', crp.can_create),
    ('edit', crp.can_edit),
    ('delete', crp.can_delete),
    ('approve', crp.can_approve),
    ('publish', crp.can_publish),
    ('manage', crp.can_manage)
  ) action_map(action, granted)
), affected as (
  select *
  from assigned_permissions
  where granted and rule->>'classification' <> 'CONFIGURABLE'
)
select
  a.church_id,
  a.church_name,
  a.role,
  a.feature_key,
  a.action,
  a.rule->>'classification' as classification,
  a.rule->>'record_scope' as record_scope,
  a.rule->>'reason' as reason,
  count(distinct ur.user_id) as affected_assigned_users
from affected a
left join public.user_roles ur
  on ur.church_id = a.church_id and lower(ur.role::text) = a.role
group by
  a.church_id, a.church_name, a.role, a.feature_key, a.action,
  a.rule->>'classification', a.rule->>'record_scope', a.rule->>'reason'
order by a.church_name, a.role, a.feature_key, a.action;
