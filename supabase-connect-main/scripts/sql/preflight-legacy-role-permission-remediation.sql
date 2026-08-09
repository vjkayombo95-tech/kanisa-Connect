-- Read-only preview for the proposed legacy role-permission remediation.
-- It returns every currently granted SYSTEM_PROTECTED cell; the reviewed plan
-- proposes removing all and only these cells. It never mutates permission data.

\set ON_ERROR_STOP on
begin read only;

with assigned_permissions as (
  select
    crp.church_id,
    c.name as church_name,
    crp.role,
    pf.key as feature_key,
    action_map.action,
    action_map.granted,
    public.church_permission_constraint_rule(crp.role,pf.key,action_map.action) as rule
  from public.church_role_permissions crp
  join public.churches c on c.id=crp.church_id
  join public.platform_features pf on pf.id=crp.feature_id
  cross join lateral (values
    ('view',crp.can_view),
    ('create',crp.can_create),
    ('edit',crp.can_edit),
    ('delete',crp.can_delete),
    ('approve',crp.can_approve),
    ('publish',crp.can_publish),
    ('manage',crp.can_manage)
  ) action_map(action,granted)
), proposed_removals as (
  select *
  from assigned_permissions
  where granted
    and rule->>'classification'='SYSTEM_PROTECTED'
)
select
  p.church_id,
  p.church_name,
  p.role,
  p.feature_key,
  p.action,
  p.granted as current_granted_value,
  p.rule->>'classification' as canonical_classification,
  case
    when p.rule->>'reason'='This feature and action combination is not supported by the application.'
      then 'CLEARLY_NON_APPLICABLE'
    else 'ROLE_BOUNDARY_VIOLATION'
  end as remediation_category,
  p.rule->>'reason' as conflict_reason,
  count(distinct ur.user_id) as affected_assigned_users
from proposed_removals p
left join public.user_roles ur
  on ur.church_id=p.church_id and lower(ur.role::text)=p.role
group by p.church_id,p.church_name,p.role,p.feature_key,p.action,p.granted,p.rule
order by p.church_name,p.role,p.feature_key,p.action;

with assigned_permissions as (
  select
    crp.role,
    pf.key as feature_key,
    action_map.action,
    action_map.granted,
    public.church_permission_constraint_rule(crp.role,pf.key,action_map.action) as rule
  from public.church_role_permissions crp
  join public.platform_features pf on pf.id=crp.feature_id
  cross join lateral (values
    ('view',crp.can_view),('create',crp.can_create),('edit',crp.can_edit),
    ('delete',crp.can_delete),('approve',crp.can_approve),
    ('publish',crp.can_publish),('manage',crp.can_manage)
  ) action_map(action,granted)
)
select
  count(*) filter (where granted and rule->>'classification'='SYSTEM_PROTECTED') as proposed_removals,
  count(*) filter (
    where granted and rule->>'classification'='SYSTEM_PROTECTED'
      and rule->>'reason'='This feature and action combination is not supported by the application.'
  ) as clearly_non_applicable,
  count(*) filter (
    where granted and rule->>'classification'='SYSTEM_PROTECTED'
      and rule->>'reason'<>'This feature and action combination is not supported by the application.'
  ) as role_boundary_violations,
  count(*) filter (where granted and rule->>'classification'='RESTRICTED') as intentionally_preserved
from assigned_permissions;

show transaction_read_only;
rollback;
