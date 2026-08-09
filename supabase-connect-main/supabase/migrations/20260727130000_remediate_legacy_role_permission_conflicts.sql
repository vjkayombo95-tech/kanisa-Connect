-- Approved migration: 20260727130000_remediate_legacy_role_permission_conflicts.sql
--
-- Removes only the 553 staging-audited SYSTEM_PROTECTED grants. The 14
-- RESTRICTED Church Admin recovery grants are intentionally not targeted.

create temporary table remediation_target_cells (
  church_id uuid not null,
  role text not null,
  feature_key text not null,
  action text not null check (action in ('view','create','edit','delete','approve','publish','manage')),
  category text not null,
  rationale text not null,
  primary key (church_id, role, feature_key, action)
) on commit drop;

-- Seven explicitly audited tenants. This is deliberately not derived from
-- public.churches: a future or unrelated tenant must never be swept in.
with churches(church_id) as (values
  ('dcbf9ea0-7acf-4766-9c76-79ac4894ecd7'::uuid),
  ('2b4c3d9f-a10f-485a-b2af-2e35c7b955c3'::uuid),
  ('33647844-1eec-4c5b-bfce-be0ca3c6c46a'::uuid),
  ('572c5be1-9839-4283-8595-c062cc1e91ce'::uuid),
  ('27fbab53-6b08-4cbd-a2f7-aaefa2a2dc51'::uuid),
  ('f9309e91-c1da-4472-9b1f-de63b0e7aa6e'::uuid),
  ('af92dd3b-fcbe-4578-bbd9-ba341e5b2f9e'::uuid)
), pairs(role,feature_key,action) as (values
  ('church_admin','announcements','approve'),
  ('church_admin','audio_processing','approve'),
  ('church_admin','bible_audio','approve'),('church_admin','bible_audio','create'),('church_admin','bible_audio','delete'),('church_admin','bible_audio','edit'),('church_admin','bible_audio','publish'),
  ('church_admin','bible_verses','approve'),('church_admin','bible_verses','create'),('church_admin','bible_verses','delete'),('church_admin','bible_verses','edit'),('church_admin','bible_verses','manage'),('church_admin','bible_verses','publish'),
  ('church_admin','catholic_content','approve'),('church_admin','catholic_content','create'),('church_admin','catholic_content','delete'),('church_admin','catholic_content','edit'),('church_admin','catholic_content','publish'),
  ('church_admin','channels','approve'),('church_admin','channels','publish'),
  ('church_admin','communities','approve'),('church_admin','communities','publish'),
  ('church_admin','community_help','publish'),
  ('church_admin','contributions','delete'),('church_admin','contributions','publish'),
  ('church_admin','event_requests','publish'),
  ('church_admin','families','approve'),('church_admin','families','publish'),
  ('church_admin','finance_intelligence','approve'),('church_admin','finance_intelligence','create'),('church_admin','finance_intelligence','delete'),('church_admin','finance_intelligence','edit'),('church_admin','finance_intelligence','publish'),
  ('church_admin','give','approve'),('church_admin','give','delete'),('church_admin','give','edit'),('church_admin','give','manage'),('church_admin','give','publish'),
  ('church_admin','kanisa_ai','approve'),('church_admin','kanisa_ai','create'),('church_admin','kanisa_ai','delete'),('church_admin','kanisa_ai','edit'),('church_admin','kanisa_ai','publish'),
  ('church_admin','mass_intentions','publish'),
  ('church_admin','members','approve'),('church_admin','members','publish'),
  ('church_admin','ministries','approve'),('church_admin','ministries','publish'),
  ('church_admin','notifications','approve'),('church_admin','notifications','delete'),
  ('church_admin','operations','approve'),('church_admin','operations','create'),('church_admin','operations','delete'),('church_admin','operations','edit'),('church_admin','operations','publish'),
  ('church_admin','pledges','delete'),('church_admin','pledges','publish'),
  ('church_admin','prayer_requests','publish'),
  ('church_admin','reports','approve'),('church_admin','reports','create'),('church_admin','reports','delete'),('church_admin','reports','edit'),('church_admin','reports','publish'),
  ('church_admin','roles','approve'),('church_admin','roles','publish'),
  ('church_admin','sacraments','delete'),('church_admin','sacraments','publish'),
  ('church_admin','sermons','approve'),
  ('treasurer','finance_intelligence','create'),('treasurer','finance_intelligence','edit'),
  ('treasurer','reports','create'),('treasurer','reports','edit')
)
insert into remediation_target_cells
select c.church_id,p.role,p.feature_key,p.action,'CLEARLY_NON_APPLICABLE',
       'The current application and backend expose no supported workflow for this feature/action pair.'
from churches c cross join pairs p;

-- Three UAT tenants contain legacy recovery-feature grants outside the two
-- intentional Church Admin view/manage cells.
with churches(church_id) as (values
  ('2b4c3d9f-a10f-485a-b2af-2e35c7b955c3'::uuid),
  ('33647844-1eec-4c5b-bfce-be0ca3c6c46a'::uuid),
  ('572c5be1-9839-4283-8595-c062cc1e91ce'::uuid)
), pairs(role,action,category,rationale) as (values
  ('church_admin','approve','CLEARLY_NON_APPLICABLE','The recovery feature supports only view and manage.'),
  ('church_admin','create','CLEARLY_NON_APPLICABLE','The recovery feature supports only view and manage.'),
  ('church_admin','delete','CLEARLY_NON_APPLICABLE','The recovery feature supports only view and manage.'),
  ('church_admin','edit','CLEARLY_NON_APPLICABLE','The recovery feature supports only view and manage.'),
  ('church_admin','publish','CLEARLY_NON_APPLICABLE','The recovery feature supports only view and manage.'),
  ('pastor','view','ROLE_BOUNDARY_VIOLATION','Only the Church Admin recovery role may hold this permission.'),
  ('secretary','view','ROLE_BOUNDARY_VIOLATION','Only the Church Admin recovery role may hold this permission.'),
  ('treasurer','view','ROLE_BOUNDARY_VIOLATION','Only the Church Admin recovery role may hold this permission.')
)
insert into remediation_target_cells
select c.church_id,p.role,'feature_permissions_admin',p.action,p.category,p.rationale
from churches c cross join pairs p;

-- Role-assignment visibility is administered only by Church Admins. Existing
-- role RPCs enforce can_manage_church_roles and do not consume roles:view.
with churches(church_id) as (values
  ('dcbf9ea0-7acf-4766-9c76-79ac4894ecd7'::uuid),
  ('2b4c3d9f-a10f-485a-b2af-2e35c7b955c3'::uuid),
  ('33647844-1eec-4c5b-bfce-be0ca3c6c46a'::uuid),
  ('572c5be1-9839-4283-8595-c062cc1e91ce'::uuid),
  ('27fbab53-6b08-4cbd-a2f7-aaefa2a2dc51'::uuid),
  ('f9309e91-c1da-4472-9b1f-de63b0e7aa6e'::uuid),
  ('af92dd3b-fcbe-4578-bbd9-ba341e5b2f9e'::uuid)
), roles(role) as (values ('pastor'),('secretary'),('treasurer'))
insert into remediation_target_cells
select c.church_id,r.role,'roles','view','ROLE_BOUNDARY_VIOLATION',
       'Only Church Admins may administer church role assignments.'
from churches c cross join roles r;

-- The member giving entry point does not define a Treasurer create workflow.
-- Treasurer finance mutations use contributions/pledges with their own checks.
insert into remediation_target_cells values
  ('dcbf9ea0-7acf-4766-9c76-79ac4894ecd7','treasurer','give','create','ROLE_BOUNDARY_VIOLATION','No Treasurer give:create workflow or server enforcement exists.'),
  ('27fbab53-6b08-4cbd-a2f7-aaefa2a2dc51','treasurer','give','create','ROLE_BOUNDARY_VIOLATION','No Treasurer give:create workflow or server enforcement exists.'),
  ('f9309e91-c1da-4472-9b1f-de63b0e7aa6e','treasurer','give','create','ROLE_BOUNDARY_VIOLATION','No Treasurer give:create workflow or server enforcement exists.'),
  ('af92dd3b-fcbe-4578-bbd9-ba341e5b2f9e','treasurer','give','create','ROLE_BOUNDARY_VIOLATION','No Treasurer give:create workflow or server enforcement exists.');

-- Read-only preview. Review this result before approving the update.
select
  t.church_id,
  c.name as church_name,
  t.role,
  t.feature_key,
  t.action,
  case t.action
    when 'view' then crp.can_view when 'create' then crp.can_create
    when 'edit' then crp.can_edit when 'delete' then crp.can_delete
    when 'approve' then crp.can_approve when 'publish' then crp.can_publish
    when 'manage' then crp.can_manage
  end as current_granted_value,
  rule.value->>'classification' as canonical_classification,
  rule.value->>'reason' as conflict_reason,
  t.category,
  t.rationale,
  count(distinct ur.user_id) as affected_assigned_users
from remediation_target_cells t
join public.churches c on c.id=t.church_id
join public.platform_features pf on pf.key=t.feature_key
join public.church_role_permissions crp
  on crp.church_id=t.church_id and crp.role=t.role and crp.feature_id=pf.id
cross join lateral (select public.church_permission_constraint_rule(t.role,t.feature_key,t.action) value) rule
left join public.user_roles ur
  on ur.church_id=t.church_id and lower(ur.role::text)=t.role
group by t.church_id,c.name,t.role,t.feature_key,t.action,crp.can_view,crp.can_create,
  crp.can_edit,crp.can_delete,crp.can_approve,crp.can_publish,crp.can_manage,
  rule.value,t.category,t.rationale
order by c.name,t.role,t.feature_key,t.action;

do $$
declare
  v_targets integer;
  v_existing integer;
  v_granted integer;
  v_invalid integer;
  v_permission_rows integer;
  v_total_granted integer;
  v_configurable_granted integer;
  v_restricted_granted integer;
  v_system_protected_granted integer;
begin
  select count(*) into v_targets from remediation_target_cells;
  if v_targets <> 553 then
    raise exception 'Expected 553 explicit remediation targets, found %',v_targets;
  end if;

  select count(*) into v_existing
  from remediation_target_cells t
  join public.platform_features pf on pf.key=t.feature_key
  join public.church_role_permissions crp
    on crp.church_id=t.church_id and crp.role=t.role and crp.feature_id=pf.id;
  if v_existing <> 553 then
    raise exception 'Expected all 553 target cells to resolve, found %',v_existing;
  end if;

  select count(*) into v_invalid
  from remediation_target_cells t
  where public.church_permission_constraint_rule(t.role,t.feature_key,t.action)->>'classification'
        <> 'SYSTEM_PROTECTED';
  if v_invalid <> 0 then
    raise exception 'Refusing to change % targets that are no longer SYSTEM_PROTECTED',v_invalid;
  end if;

  select
    count(distinct crp.id),
    count(*) filter (where x.granted),
    count(*) filter (where x.granted and rule.value->>'classification'='CONFIGURABLE'),
    count(*) filter (where x.granted and rule.value->>'classification'='RESTRICTED'),
    count(*) filter (where x.granted and rule.value->>'classification'='SYSTEM_PROTECTED')
  into v_permission_rows,v_total_granted,v_configurable_granted,
       v_restricted_granted,v_system_protected_granted
  from public.church_role_permissions crp
  join public.platform_features pf on pf.id=crp.feature_id
  cross join lateral (values
    ('view',crp.can_view),('create',crp.can_create),('edit',crp.can_edit),
    ('delete',crp.can_delete),('approve',crp.can_approve),
    ('publish',crp.can_publish),('manage',crp.can_manage)
  ) x(action,granted)
  cross join lateral (
    select public.church_permission_constraint_rule(crp.role,pf.key,x.action) value
  ) rule;
  if v_permission_rows <> 881 then
    raise exception 'Permission-row count drift: expected 881, found %',v_permission_rows;
  end if;
  if v_configurable_granted <> 1954 then
    raise exception 'CONFIGURABLE grant drift: expected 1954, found %',v_configurable_granted;
  end if;
  if v_restricted_granted <> 14 then
    raise exception 'Recovery grant drift: expected 14 RESTRICTED grants, found %',v_restricted_granted;
  end if;
  if (v_system_protected_granted,v_total_granted) not in ((553,2521),(0,1968)) then
    raise exception 'Unexpected grant state: SYSTEM_PROTECTED=%, total=%',
      v_system_protected_granted,v_total_granted;
  end if;

  select count(*) into v_granted
  from remediation_target_cells t
  join public.platform_features pf on pf.key=t.feature_key
  join public.church_role_permissions crp
    on crp.church_id=t.church_id and crp.role=t.role and crp.feature_id=pf.id
  where case t.action
    when 'view' then crp.can_view when 'create' then crp.can_create
    when 'edit' then crp.can_edit when 'delete' then crp.can_delete
    when 'approve' then crp.can_approve when 'publish' then crp.can_publish
    when 'manage' then crp.can_manage end;
  if v_granted not in (0,553) then
    raise exception 'Partial target drift detected: % of 553 cells are granted',v_granted;
  end if;
end;
$$;

-- One row update per affected role/feature tuple; only explicitly targeted
-- action columns are changed, and all other permission values are preserved.
update public.church_role_permissions crp
set
  can_view = case when exists (
    select 1 from remediation_target_cells t
    where t.church_id=crp.church_id and t.role=crp.role and t.feature_key=pf.key and t.action='view'
  ) then false else crp.can_view end,
  can_create = case when exists (
    select 1 from remediation_target_cells t
    where t.church_id=crp.church_id and t.role=crp.role and t.feature_key=pf.key and t.action='create'
  ) then false else crp.can_create end,
  can_edit = case when exists (
    select 1 from remediation_target_cells t
    where t.church_id=crp.church_id and t.role=crp.role and t.feature_key=pf.key and t.action='edit'
  ) then false else crp.can_edit end,
  can_delete = case when exists (
    select 1 from remediation_target_cells t
    where t.church_id=crp.church_id and t.role=crp.role and t.feature_key=pf.key and t.action='delete'
  ) then false else crp.can_delete end,
  can_approve = case when exists (
    select 1 from remediation_target_cells t
    where t.church_id=crp.church_id and t.role=crp.role and t.feature_key=pf.key and t.action='approve'
  ) then false else crp.can_approve end,
  can_publish = case when exists (
    select 1 from remediation_target_cells t
    where t.church_id=crp.church_id and t.role=crp.role and t.feature_key=pf.key and t.action='publish'
  ) then false else crp.can_publish end,
  can_manage = case when exists (
    select 1 from remediation_target_cells t
    where t.church_id=crp.church_id and t.role=crp.role and t.feature_key=pf.key and t.action='manage'
  ) then false else crp.can_manage end
from public.platform_features pf
where pf.id=crp.feature_id
  and exists (
    select 1 from remediation_target_cells t
    where t.church_id=crp.church_id and t.role=crp.role and t.feature_key=pf.key
  );

do $$
declare
  v_remaining integer;
  v_recovery integer;
  v_permission_rows integer;
  v_total_granted integer;
  v_configurable_granted integer;
  v_restricted_granted integer;
  v_system_protected_granted integer;
  v_total_conflicts integer;
  v_fingerprint text;
begin
  select count(*) into v_remaining
  from remediation_target_cells t
  join public.platform_features pf on pf.key=t.feature_key
  join public.church_role_permissions crp
    on crp.church_id=t.church_id and crp.role=t.role and crp.feature_id=pf.id
  where case t.action
    when 'view' then crp.can_view when 'create' then crp.can_create
    when 'edit' then crp.can_edit when 'delete' then crp.can_delete
    when 'approve' then crp.can_approve when 'publish' then crp.can_publish
    when 'manage' then crp.can_manage end;
  if v_remaining <> 0 then
    raise exception 'Remediation incomplete: % target cells remain granted',v_remaining;
  end if;

  select count(*) into v_recovery
  from public.church_role_permissions crp
  join public.platform_features pf on pf.id=crp.feature_id
  where crp.church_id in (
    'dcbf9ea0-7acf-4766-9c76-79ac4894ecd7','2b4c3d9f-a10f-485a-b2af-2e35c7b955c3',
    '33647844-1eec-4c5b-bfce-be0ca3c6c46a','572c5be1-9839-4283-8595-c062cc1e91ce',
    '27fbab53-6b08-4cbd-a2f7-aaefa2a2dc51','f9309e91-c1da-4472-9b1f-de63b0e7aa6e',
    'af92dd3b-fcbe-4578-bbd9-ba341e5b2f9e'
  )
    and crp.role='church_admin' and pf.key='feature_permissions_admin'
    and crp.can_view and crp.can_manage;
  if v_recovery <> 7 then
    raise exception 'Mandatory recovery verification failed: expected 7 rows, found %',v_recovery;
  end if;

  select
    count(distinct crp.id),
    count(*) filter (where x.granted),
    count(*) filter (where x.granted and rule.value->>'classification'='CONFIGURABLE'),
    count(*) filter (where x.granted and rule.value->>'classification'='RESTRICTED'),
    count(*) filter (where x.granted and rule.value->>'classification'='SYSTEM_PROTECTED'),
    count(*) filter (where x.granted and rule.value->>'classification'<>'CONFIGURABLE')
  into v_permission_rows,v_total_granted,v_configurable_granted,
       v_restricted_granted,v_system_protected_granted,v_total_conflicts
  from public.church_role_permissions crp
  join public.platform_features pf on pf.id=crp.feature_id
  cross join lateral (values
    ('view',crp.can_view),('create',crp.can_create),('edit',crp.can_edit),
    ('delete',crp.can_delete),('approve',crp.can_approve),
    ('publish',crp.can_publish),('manage',crp.can_manage)
  ) x(action,granted)
  cross join lateral (
    select public.church_permission_constraint_rule(crp.role,pf.key,x.action) value
  ) rule;

  select md5(string_agg(concat_ws('|',
    crp.church_id::text,crp.role,pf.key,crp.can_view::text,crp.can_create::text,
    crp.can_edit::text,crp.can_delete::text,crp.can_approve::text,
    crp.can_publish::text,crp.can_manage::text
  ),E'\n' order by crp.church_id,crp.role,pf.key))
  into v_fingerprint
  from public.church_role_permissions crp
  join public.platform_features pf on pf.id=crp.feature_id;

  if v_permission_rows <> 881 or v_total_granted <> 1968
     or v_configurable_granted <> 1954 or v_restricted_granted <> 14
     or v_system_protected_granted <> 0 or v_total_conflicts <> 14 then
    raise exception 'Post-remediation invariant failed: rows=%, total=%, configurable=%, restricted=%, system=%, conflicts=%',
      v_permission_rows,v_total_granted,v_configurable_granted,
      v_restricted_granted,v_system_protected_granted,v_total_conflicts;
  end if;
  if v_fingerprint <> 'e394c77baca206663f75b4631094ebde' then
    raise exception 'Post-remediation fingerprint mismatch: %',v_fingerprint;
  end if;
end;
$$;

-- psql --single-transaction makes this ledger write atomic with every update
-- and assertion above. A failed assertion therefore records nothing.
insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20260727130000','remediate_legacy_role_permission_conflicts',null)
on conflict (version) do nothing;
