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

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('71000000-0000-4000-8000-000000000001', 'help-owner@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('71000000-0000-4000-8000-000000000002', 'help-member@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('71000000-0000-4000-8000-000000000003', 'help-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('71000000-0000-4000-8000-000000000004', 'help-foreign@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, owner_id, created_by) values
  ('72000000-0000-4000-8000-000000000001', 'Community Help RLS A', 'community-help-rls-a', '71000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000003'),
  ('72000000-0000-4000-8000-000000000002', 'Community Help RLS B', 'community-help-rls-b', '71000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004');

insert into public.members (id, church_id, user_id, full_name, status) values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Help Owner', 'active'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'Help Member', 'active'),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000003', 'Help Admin', 'active'),
  ('73000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000004', 'Help Foreign', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'member'),
  ('71000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'member'),
  ('71000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', 'church_admin'),
  ('71000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000002', 'member');

insert into public.community_help_requests
  (id, member_id, church_id, category, description, target_amount, current_amount, status)
values
  ('74000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'medical', 'Owner pending request', 1000, 0, 'pending'),
  ('74000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'food', 'Owner rejected request', 1000, 0, 'rejected'),
  ('74000000-0000-4000-8000-000000000003', '73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'education', 'Owner approved request', 1000, 0, 'approved'),
  ('74000000-0000-4000-8000-000000000004', '73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'housing', 'Other member pending request', 1000, 0, 'pending'),
  ('74000000-0000-4000-8000-000000000005', '73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'funeral', 'Other member approved request', 1000, 0, 'approved'),
  ('74000000-0000-4000-8000-000000000006', '73000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000002', 'medical', 'Foreign approved request', 1000, 0, 'approved');

set local role authenticated;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000001'),
  'owner can read own pending help request'
);
select pg_temp.assert_true(
  exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000002'),
  'owner can read own rejected help request'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000005'),
  'same-church member can read approved help request'
);
select pg_temp.assert_true(
  not exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000001'),
  'same-church member cannot read another member pending help request'
);
select pg_temp.assert_true(
  not exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000002'),
  'same-church member cannot read another member rejected help request'
);
select pg_temp.assert_true(
  not exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000006'),
  'same-church member cannot read cross-church approved help request'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  not exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000005'),
  'cross-church member cannot read other church approved help request'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000004'),
  'authorized church manager can read pending help requests'
);
select pg_temp.assert_true(
  not exists (select 1 from public.community_help_requests where id = '74000000-0000-4000-8000-000000000006'),
  'authorized church manager cannot read cross-church help requests'
);

reset role;

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'community_help_requests'
      and policyname in ('Church members can view help requests', 'help requests same church')
  ),
  'overbroad same-church help request select policies are absent'
);

rollback;
