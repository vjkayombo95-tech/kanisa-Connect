\set ON_ERROR_STOP on
begin;

select '1..1';

create or replace function pg_temp.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

do $$
declare v_definition text;
begin
  assert exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id, church_id, role)'
  ), 'user_roles must reject duplicate user/church/role tuples';
  assert exists (
    select 1 from pg_attribute
    where attrelid='public.user_role_duplicate_archive'::regclass
      and attname='normalized_role'
      and attnum > 0
      and not attisdropped
  ), 'duplicate archive must retain canonical role context';
  assert not has_table_privilege('authenticated', 'public.user_role_duplicate_archive', 'SELECT'),
    'authenticated users must not read the duplicate archive';
  assert exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='user_roles'
  ), 'user_roles must be in the realtime publication';

  select pg_get_functiondef('public.has_church_feature_permission(uuid,uuid,text,text)'::regprocedure)
  into v_definition;
  assert v_definition ilike '%return exists%', 'effective permissions must aggregate role grants';
  assert v_definition ilike '%lower(ur.role::text) = crp.role%', 'grants must match assigned roles';
  assert v_definition not ilike '%select lower(ur.role::text) into%', 'helper must not select one role';
  assert v_definition ilike '%is_feature_available_for_church%', 'subscription/platform availability must remain enforced';

  select pg_get_functiondef('public.assign_church_member_role(uuid,uuid,text)'::regprocedure)
  into v_definition;
  assert v_definition ilike '%insert into public.user_roles%', 'assignment must insert a role row';
  assert v_definition not ilike '%update public.user_roles%set role%', 'assignment must not replace another role';

  select pg_get_functiondef('public.protect_last_church_admin()'::regprocedure)
  into v_definition;
  assert v_definition ilike '%for update%', 'last-admin check must serialize concurrent removals';

  assert exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='churches'
      and policyname='church settings manage update'
      and permissive='RESTRICTIVE'
      and coalesce(qual, '') ilike '%has_church_feature_permission%feature_permissions_admin%manage%'
  ), 'Church settings UPDATE must have a restrictive authoritative manage policy';
  assert exists (
    select 1 from pg_trigger
    where tgrelid='public.churches'::regclass
      and tgname='enforce_church_settings_manage_permission'
      and not tgisinternal
  ), 'Church settings UPDATE must retain trigger defense in depth';
  assert exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='events'
      and policyname='Church managers can insert events'
      and coalesce(with_check, '') ilike '%has_church_feature_permission%events%create%'
  ), 'Event INSERT policy must honor events:create';
  assert exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='events'
      and policyname='Church managers can update events'
      and coalesce(qual, '') ilike '%has_church_feature_permission%events%edit%'
  ), 'Event UPDATE policy must honor events:edit';
  assert exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='events'
      and policyname='Church managers can update events'
      and coalesce(qual, '') ilike '%events%manage%'
      and coalesce(qual, '') ilike '%created_by%auth.uid%'
  ), 'Event UPDATE must require ownership or events:manage';
  assert exists (
    select 1 from pg_trigger
    where tgrelid='public.events'::regclass
      and tgname='enforce_event_mutation_scope'
      and not tgisinternal
  ), 'Event ownership scope must retain trigger defense in depth';
  assert exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='events'
      and policyname='Church managers can delete events'
      and coalesce(qual, '') ilike '%has_church_feature_permission%events%delete%'
  ), 'Event DELETE policy must honor events:delete';

  select pg_get_functiondef('public.save_church_announcement(uuid,uuid,text,text,boolean,timestamptz,timestamptz,text,boolean,text[],text,text,boolean,text,text,boolean)'::regprocedure)
  into v_definition;
  assert v_definition ilike '%has_church_feature_permission%announcements%create%', 'Announcement save RPC must honor create';
  assert v_definition ilike '%has_church_feature_permission%announcements%edit%', 'Announcement save RPC must honor edit';
  assert v_definition ilike '%has_church_feature_permission%announcements%publish%', 'Announcement save RPC must honor publish transitions';
  assert v_definition not ilike '%can_manage_church_roles%', 'Announcement save RPC must not use role-administration permission';
end $$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('d1000000-0000-4000-8000-000000000001','authenticated','authenticated','multi-admin@test.invalid','',now(),'{}','{}',now(),now()),
  ('d2000000-0000-4000-8000-000000000002','authenticated','authenticated','multi-staff@test.invalid','',now(),'{}','{}',now(),now()),
  ('d3000000-0000-4000-8000-000000000003','authenticated','authenticated','multi-other@test.invalid','',now(),'{}','{}',now(),now());

insert into public.churches (id,name,slug) values
  ('da000000-0000-4000-8000-000000000001','Multi Role Test A','multi-role-test-a'),
  ('db000000-0000-4000-8000-000000000002','Multi Role Test B','multi-role-test-b');

insert into public.members (id,church_id,user_id,full_name,email,status) values
  ('dc000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Multi Admin','multi-admin@test.invalid','active'),
  ('dc000000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','Multi Staff','multi-staff@test.invalid','active'),
  ('dc000000-0000-4000-8000-000000000003','db000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000003','Other Church','multi-other@test.invalid','active');

insert into public.user_roles (id,user_id,church_id,role) values
  ('de000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','church_admin'),
  ('de000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','secretary'),
  ('de000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','treasurer'),
  ('de000000-0000-4000-8000-000000000004','d3000000-0000-4000-8000-000000000003','db000000-0000-4000-8000-000000000002','church_admin');

update public.subscriptions
set plan='pro', status='active', started_at=now(), expires_at=now()+interval '7 days'
where church_id in ('da000000-0000-4000-8000-000000000001','db000000-0000-4000-8000-000000000002');

-- This suite verifies the additive Pastor grant itself. Staging may keep the
-- optional Prayer Requests feature globally disabled outside this transaction.
update public.platform_features
set globally_enabled=true
where key='prayer_requests' and not is_mandatory;

update public.church_features cf set enabled=true, locked=false
from public.platform_features pf
where cf.feature_id=pf.id and pf.key in ('contributions','prayer_requests')
  and cf.church_id in ('da000000-0000-4000-8000-000000000001','db000000-0000-4000-8000-000000000002');

update public.church_role_permissions crp set can_view=false
from public.platform_features pf
where crp.feature_id=pf.id and pf.key='contributions'
  and crp.church_id='da000000-0000-4000-8000-000000000001';
update public.church_role_permissions crp set can_view=true
from public.platform_features pf
where crp.feature_id=pf.id and pf.key='contributions'
  and crp.church_id='da000000-0000-4000-8000-000000000001'
  and crp.role in ('church_admin','treasurer');

insert into public.contributions (id,church_id,amount,donor_name,payment_reference) values
  ('dd000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001',1000,'Test Donor','MULTI-ROLE-TEST-A'),
  ('dd000000-0000-4000-8000-000000000002','db000000-0000-4000-8000-000000000002',2000,'Other Donor','MULTI-ROLE-TEST-B');

insert into public.prayer_requests (id,church_id,member_id,request_text,status,privacy) values
  ('df000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','dc000000-0000-4000-8000-000000000002','Pastoral UAT private request','pending','private_to_pastor_admin'),
  ('df000000-0000-4000-8000-000000000002','db000000-0000-4000-8000-000000000002','dc000000-0000-4000-8000-000000000003','Other church private request','pending','private_to_pastor_admin');

-- Single role and multi-role union, including RLS church isolation.
set local role authenticated;
set local request.jwt.claim.sub = 'd1000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(public.has_church_feature_permission(auth.uid(),'da000000-0000-4000-8000-000000000001','contributions','view'),'single Church Admin lost access');
select pg_temp.assert_true((select count(*)=1 from public.contributions),'Church Admin RLS did not isolate the church');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'd2000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(public.has_church_feature_permission(auth.uid(),'da000000-0000-4000-8000-000000000001','contributions','view'),'Treasurer grant was not unioned with Secretary');
select pg_temp.assert_true((select count(*)=1 from public.contributions),'multi-role RLS access or isolation failed');

-- Another church never grants access even when that user is an administrator there.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'd3000000-0000-4000-8000-000000000003';
select pg_temp.assert_true(not public.has_church_feature_permission(auth.uid(),'da000000-0000-4000-8000-000000000001','contributions','view'),'cross-church permission leaked');
select pg_temp.assert_true((select count(*)=1 from public.contributions),'cross-church RLS leaked rows');

-- Assignment inserts; duplicate assignment rejects; one removal preserves the other role.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'd1000000-0000-4000-8000-000000000001';
select public.assign_church_member_role('da000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','pastor');
select pg_temp.assert_true((select count(*)=2 from public.user_roles where user_id=auth.uid() and church_id='da000000-0000-4000-8000-000000000001'),'Church Admin + Pastor assignment did not preserve both roles');
select pg_temp.assert_true(public.has_church_feature_permission(auth.uid(),'da000000-0000-4000-8000-000000000001','prayer_requests','view'),'Church Admin + Pastor lost the Pastoral Care view grant');
select pg_temp.assert_true((select count(*)=1 from public.prayer_requests),'Church Admin + Pastor could not load tenant-isolated Pastoral Care data');
do $$ begin
  begin
    perform public.assign_church_member_role('da000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','pastor');
    raise exception 'ASSERTION FAILED: duplicate assignment succeeded';
  exception when unique_violation then null; end;
end $$;
select public.remove_church_member_role((select id from public.user_roles where user_id='d1000000-0000-4000-8000-000000000001' and role='pastor'));
select pg_temp.assert_true((select count(*)=1 from public.user_roles where user_id=auth.uid() and role='church_admin'),'removing Pastor changed Church Admin');

-- The final Church Admin cannot be removed.
do $$ begin
  begin
    perform public.remove_church_member_role((select id from public.user_roles where user_id=auth.uid() and role='church_admin'));
    raise exception 'ASSERTION FAILED: final Church Admin removal succeeded';
  exception when check_violation then null; end;
end $$;

-- Removing Treasurer leaves Secretary but removes the Treasurer-only grant/RLS access.
select public.remove_church_member_role('de000000-0000-4000-8000-000000000003');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'd2000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select count(*)=1 from public.user_roles where user_id=auth.uid() and role='secretary'),'removing Treasurer removed Secretary');
select pg_temp.assert_true(not public.has_church_feature_permission(auth.uid(),'da000000-0000-4000-8000-000000000001','contributions','view'),'removed Treasurer grant remained active');
select pg_temp.assert_true((select count(*)=0 from public.contributions),'RLS retained removed Treasurer access');

-- Removing every staff role leaves only active-member permissions, not staff access.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'd1000000-0000-4000-8000-000000000001';
select public.remove_church_member_role('de000000-0000-4000-8000-000000000002');
select pg_temp.assert_true((select count(*)=0 from public.user_roles where user_id='d2000000-0000-4000-8000-000000000002'),'all staff roles were not removed');

-- Subscription and church feature gates remain intersections over the role union.
reset role;
update public.subscriptions set expires_at=now()-interval '1 minute'
where church_id='da000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = 'd1000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not public.has_church_feature_permission(auth.uid(),'da000000-0000-4000-8000-000000000001','contributions','view'),'expired subscription was bypassed');
reset role;
update public.subscriptions set expires_at=now()+interval '7 days'
where church_id='da000000-0000-4000-8000-000000000001';
update public.church_features cf set enabled=false
from public.platform_features pf
where cf.feature_id=pf.id and pf.key='contributions' and cf.church_id='da000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = 'd1000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not public.has_church_feature_permission(auth.uid(),'da000000-0000-4000-8000-000000000001','contributions','view'),'disabled church feature was bypassed');

select 'ok 1 - multi-role permission, invariant, and RLS assertions passed';
rollback;
