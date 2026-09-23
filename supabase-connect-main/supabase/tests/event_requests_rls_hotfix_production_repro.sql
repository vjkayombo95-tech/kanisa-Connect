\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(_condition boolean, _label text)
returns void language plpgsql as $$
begin
  if not coalesce(_condition, false) then
    raise exception 'FAIL: %', _label;
  end if;
  raise notice 'PASS: %', _label;
end;
$$;

create or replace function pg_temp.assert_raises_insufficient_privilege(_sql text, _label text)
returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'FAIL: %', _label;
exception
  when insufficient_privilege then
    raise notice 'PASS: %', _label;
end;
$$;

create temp table before_member_policies as
select policyname, cmd, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'event_requests'
  and policyname in ('Members can read own event requests', 'Members can create own event requests');

select pg_temp.assert_true(
  (select count(*) from before_member_policies) = 2,
  'member select and insert policies exist before hotfix'
);

-- Reproduce the Production-relevant shape and remove local/staging-only extras
-- inside this transaction.
drop trigger if exists enforce_feature_mutation_permission on public.event_requests;
drop trigger if exists enforce_event_request_staff_update on public.event_requests;
drop policy if exists "tenant feature select" on public.event_requests;
drop policy if exists "tenant feature insert" on public.event_requests;
drop policy if exists "tenant feature delete" on public.event_requests;
drop policy if exists "Church staff can read permitted event requests" on public.event_requests;
drop policy if exists "Church staff can review permitted event requests" on public.event_requests;

create policy "Church staff can read permitted event requests"
on public.event_requests
for select
to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'event_requests', 'view')
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
  and public.has_church_feature_permission(auth.uid(), church_id, 'event_requests', 'edit')
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
  and public.has_church_feature_permission(auth.uid(), church_id, 'event_requests', 'edit')
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

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('8a100000-0000-4000-8000-000000000001', 'hotfix-owner@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('8a100000-0000-4000-8000-000000000002', 'hotfix-member@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('8a100000-0000-4000-8000-000000000003', 'hotfix-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('8a100000-0000-4000-8000-000000000004', 'hotfix-foreign-admin@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug) values
  ('8a200000-0000-4000-8000-000000000001', 'Hotfix RLS Church A', 'hotfix-rls-church-a'),
  ('8a200000-0000-4000-8000-000000000002', 'Hotfix RLS Church B', 'hotfix-rls-church-b');

insert into public.members (id, church_id, user_id, full_name, email, status) values
  ('8a300000-0000-4000-8000-000000000001', '8a200000-0000-4000-8000-000000000001', '8a100000-0000-4000-8000-000000000001', 'Hotfix Owner', 'hotfix-owner@test.invalid', 'active'),
  ('8a300000-0000-4000-8000-000000000002', '8a200000-0000-4000-8000-000000000001', '8a100000-0000-4000-8000-000000000002', 'Hotfix Other Member', 'hotfix-member@test.invalid', 'active'),
  ('8a300000-0000-4000-8000-000000000003', '8a200000-0000-4000-8000-000000000002', '8a100000-0000-4000-8000-000000000004', 'Hotfix Foreign Member', 'hotfix-foreign-admin@test.invalid', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('8a100000-0000-4000-8000-000000000001', '8a200000-0000-4000-8000-000000000001', 'member'),
  ('8a100000-0000-4000-8000-000000000002', '8a200000-0000-4000-8000-000000000001', 'member'),
  ('8a100000-0000-4000-8000-000000000003', '8a200000-0000-4000-8000-000000000001', 'church_admin'),
  ('8a100000-0000-4000-8000-000000000004', '8a200000-0000-4000-8000-000000000002', 'church_admin');

insert into public.church_features (church_id, feature_id, enabled)
select c.id, pf.id, true
from public.churches c
cross join public.platform_features pf
where c.id in ('8a200000-0000-4000-8000-000000000001', '8a200000-0000-4000-8000-000000000002')
  and pf.key = 'event_requests'
on conflict (church_id, feature_id) do update set enabled = excluded.enabled;

insert into public.church_role_permissions
  (church_id, role, feature_id, can_view, can_edit, can_approve, can_manage)
select c.id, 'church_admin', pf.id, true, true, true, true
from public.churches c
cross join public.platform_features pf
where c.id in ('8a200000-0000-4000-8000-000000000001', '8a200000-0000-4000-8000-000000000002')
  and pf.key = 'event_requests'
on conflict (church_id, role, feature_id) do update set
  can_view = excluded.can_view,
  can_edit = excluded.can_edit,
  can_approve = excluded.can_approve,
  can_manage = excluded.can_manage;

insert into public.event_requests
  (id, church_id, member_id, request_type, type, title, status, description, admin_notes)
values
  ('8a400000-0000-4000-8000-000000000001', '8a200000-0000-4000-8000-000000000001', '8a300000-0000-4000-8000-000000000001', 'parish_event', 'baptism', 'Hotfix Baptism', 'submitted', 'Same church baptism request', null),
  ('8a400000-0000-4000-8000-000000000002', '8a200000-0000-4000-8000-000000000001', '8a300000-0000-4000-8000-000000000002', 'parish_event', 'wedding', 'Hotfix Wedding', 'submitted', 'Other member request', null),
  ('8a400000-0000-4000-8000-000000000003', '8a200000-0000-4000-8000-000000000002', '8a300000-0000-4000-8000-000000000003', 'parish_event', 'funeral', 'Foreign Funeral', 'submitted', 'Cross church request', null);

grant select on public.user_roles to authenticated;
grant select on public.platform_features to authenticated;
revoke select on public.church_role_permissions from authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '8a100000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'hotfix-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"hotfix-admin@test.invalid"}', true);

select pg_temp.assert_raises_insufficient_privilege(
  'select 1 from public.church_role_permissions limit 1',
  'authenticated still has no direct SELECT on church_role_permissions'
);

select pg_temp.assert_raises_insufficient_privilege(
  'select count(*) from public.event_requests where church_id = ''8a200000-0000-4000-8000-000000000001''',
  'existing direct staff policy fails with permission denied for church_role_permissions'
);

reset role;

\i supabase/migrations/20260921150000_fix_event_request_staff_policy_permissions.sql

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '8a100000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'hotfix-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"hotfix-admin@test.invalid"}', true);

select pg_temp.assert_true(
  exists (select 1 from public.event_requests where id = '8a400000-0000-4000-8000-000000000001'),
  'same-church church_admin can SELECT event request after hotfix'
);

select pg_temp.assert_true(
  not exists (select 1 from public.event_requests where id = '8a400000-0000-4000-8000-000000000003'),
  'same-church church_admin cannot SELECT cross-church event request after hotfix'
);

update public.event_requests
set admin_notes = 'Reviewed after hotfix'
where id = '8a400000-0000-4000-8000-000000000001';

reset role;
select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '8a400000-0000-4000-8000-000000000001'
      and admin_notes = 'Reviewed after hotfix'
  ),
  'same-church church_admin can UPDATE event request after hotfix'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '8a100000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'hotfix-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"hotfix-admin@test.invalid"}', true);

do $$
begin
  update public.event_requests
  set church_id = '8a200000-0000-4000-8000-000000000002'
  where id = '8a400000-0000-4000-8000-000000000001';

  raise exception 'FAIL: same-church church_admin moved request to another church';
exception
  when insufficient_privilege then
    raise notice 'PASS: same-church church_admin cannot move request to another church';
end $$;

reset role;
select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '8a400000-0000-4000-8000-000000000001'
      and church_id = '8a200000-0000-4000-8000-000000000001'
  ),
  'same-church church_admin without target-church role cannot move request to another church'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '8a100000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'hotfix-owner@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"hotfix-owner@test.invalid"}', true);

select pg_temp.assert_true(
  exists (select 1 from public.event_requests where id = '8a400000-0000-4000-8000-000000000001'),
  'member can SELECT own event request after hotfix'
);

select pg_temp.assert_true(
  not exists (select 1 from public.event_requests where id = '8a400000-0000-4000-8000-000000000002'),
  'member cannot SELECT another member event request after hotfix'
);

select pg_temp.assert_true(
  not exists (select 1 from public.event_requests where id = '8a400000-0000-4000-8000-000000000003'),
  'member cannot SELECT cross-church event request after hotfix'
);

select pg_temp.assert_raises_insufficient_privilege(
  'select 1 from public.church_role_permissions limit 1',
  'authenticated still lacks direct SELECT on church_role_permissions after hotfix'
);

reset role;

select pg_temp.assert_true(
  not exists (
    (
      select policyname, cmd, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
      from pg_policies
      where schemaname = 'public'
        and tablename = 'event_requests'
        and policyname in ('Members can read own event requests', 'Members can create own event requests')
    )
    except
    select policyname, cmd, qual, with_check from before_member_policies
  )
  and not exists (
    (select policyname, cmd, qual, with_check from before_member_policies)
    except
    select policyname, cmd, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname in ('Members can read own event requests', 'Members can create own event requests')
  ),
  'member SELECT and INSERT policies are unchanged by hotfix'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname in ('Church staff can read permitted event requests', 'Church staff can review permitted event requests')
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'church_role_permissions|platform_features'
  ),
  'hotfix staff policies do not directly reference permission tables'
);

rollback;
