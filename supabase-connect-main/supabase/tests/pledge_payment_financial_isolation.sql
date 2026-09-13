\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not condition then
    raise exception 'FAIL: %', message;
  end if;
end
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('81000000-0000-4000-8000-000000000001', 'pledge-owner@example.test', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'pledge-same-church@example.test', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000003', 'pledge-admin@example.test', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000004', 'pledge-leader@example.test', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000005', 'pledge-cross-church@example.test', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, owner_id, created_by)
values
  ('82000000-0000-4000-8000-000000000001', 'Pledge Isolation Church', 'pledge-isolation-church', '81000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000003'),
  ('82000000-0000-4000-8000-000000000002', 'Pledge Cross Church', 'pledge-cross-church', '81000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-000000000005');

insert into public.members (id, church_id, user_id, full_name, status)
values
  ('83000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'Pledge Owner', 'active'),
  ('83000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'Same Church Member', 'active'),
  ('83000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000003', 'Pledge Admin', 'active'),
  ('83000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000004', 'Community Leader', 'active'),
  ('83000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000005', 'Cross Church Member', 'active');

insert into public.user_roles (user_id, church_id, role)
values
  ('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'member'),
  ('81000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000001', 'member'),
  ('81000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001', 'church_admin'),
  ('81000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000001', 'member'),
  ('81000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', 'member');

insert into public.communities (id, church_id, name, chairperson_id, mwenyekiti_id)
values (
  '84000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'Pledge Isolation Community',
  '83000000-0000-4000-8000-000000000004',
  '83000000-0000-4000-8000-000000000004'
);

insert into public.pledges (id, member_id, church_id, community_id, amount_pledged, amount_paid, status)
values (
  '85000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  10000,
  0,
  'pending'
);

insert into public.pledge_payments (id, pledge_id, member_id, amount, payment_method, transaction_id, verification_status)
values (
  '86000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  2500,
  'cash',
  'pledge-isolation-payment-1',
  'pending'
);

set local role authenticated;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  exists (
    select 1
    from public.pledge_payments
    where id = '86000000-0000-4000-8000-000000000001'
  ),
  'owner can access own pledge payment'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  not exists (
    select 1
    from public.pledge_payments
    where id = '86000000-0000-4000-8000-000000000001'
  ),
  'unrelated same-church member cannot access another member pledge payment'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  not exists (
    select 1
    from public.pledge_payments
    where id = '86000000-0000-4000-8000-000000000001'
  ),
  'cross-church member cannot access pledge payment'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  exists (
    select 1
    from public.pledge_payments
    where id = '86000000-0000-4000-8000-000000000001'
  ),
  'authorized church admin can access pledge payment'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  exists (
    select 1
    from public.pledge_payments
    where id = '86000000-0000-4000-8000-000000000001'
  ),
  'authorized community leader can access pledge payment'
);

reset role;

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pledge_payments'
      and policyname = 'payments same church'
  ),
  'obsolete payments same church policy is removed'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pledge_payments'
      and policyname = 'Users can view accessible pledge payments'
      and cmd = 'SELECT'
  ),
  'authorized pledge payment select policy remains'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pledge_payments'
      and cmd = 'SELECT'
      and permissive = 'PERMISSIVE'
      and lower(coalesce(qual, '')) like '%get_user_church_id%'
  ),
  'no broad same-church pledge payment select policy remains'
);

rollback;
