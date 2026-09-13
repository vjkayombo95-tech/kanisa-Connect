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

create or replace function pg_temp.assert_raises_rls(_sql text, _label text)
returns void language plpgsql as $$
begin
  begin
    execute _sql;
    raise exception 'FAIL: %', _label;
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: %', _label;
  end;
end;
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('61000000-0000-4000-8000-000000000001', 'channel-creator@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('61000000-0000-4000-8000-000000000002', 'channel-member@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('61000000-0000-4000-8000-000000000003', 'channel-unrelated@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('61000000-0000-4000-8000-000000000004', 'channel-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('61000000-0000-4000-8000-000000000005', 'channel-leader@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('61000000-0000-4000-8000-000000000006', 'channel-foreign@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, owner_id, created_by) values
  ('62000000-0000-4000-8000-000000000001', 'Channel RLS Church A', 'channel-rls-a', '61000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000004'),
  ('62000000-0000-4000-8000-000000000002', 'Channel RLS Church B', 'channel-rls-b', '61000000-0000-4000-8000-000000000006', '61000000-0000-4000-8000-000000000006');

insert into public.members (id, church_id, user_id, full_name, status) values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'Channel Creator', 'active'),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'Channel Member', 'active'),
  ('63000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 'Unrelated Member', 'active'),
  ('63000000-0000-4000-8000-000000000004', '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000004', 'Channel Admin', 'active'),
  ('63000000-0000-4000-8000-000000000005', '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000005', 'Community Leader', 'active'),
  ('63000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000006', 'Foreign Member', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('61000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'member'),
  ('61000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', 'member'),
  ('61000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', 'member'),
  ('61000000-0000-4000-8000-000000000004', '62000000-0000-4000-8000-000000000001', 'church_admin'),
  ('61000000-0000-4000-8000-000000000005', '62000000-0000-4000-8000-000000000001', 'member'),
  ('61000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000002', 'member');

insert into public.communities (
  id,
  name,
  church_id,
  chairperson_id,
  mwenyekiti_id
) values (
  '64000000-0000-4000-8000-000000000001',
  'Channel Test Jumuiya',
  '62000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000005',
  '63000000-0000-4000-8000-000000000005'
);

insert into public.chat_channels (
  id,
  church_id,
  name,
  description,
  owner_scope,
  audience_type,
  community_id,
  metadata,
  created_by
) values (
  '65000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  'Private Channel',
  'Sensitive private channel metadata',
  'community_leader',
  'community_members',
  '64000000-0000-4000-8000-000000000001',
  '{"sensitive":"metadata"}',
  '61000000-0000-4000-8000-000000000001'
);

insert into public.chat_channel_members (channel_id, user_id, member_id) values
  ('65000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001'),
  ('65000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002');

insert into public.chat_messages (
  id,
  channel_id,
  sender_user_id,
  sender_member_id,
  body
) values (
  '66000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  'Private channel message'
);

set local role authenticated;

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  exists (select 1 from public.chat_channels where id = '65000000-0000-4000-8000-000000000001'),
  'channel creator can select authorized channel metadata'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  exists (select 1 from public.chat_channels where id = '65000000-0000-4000-8000-000000000001'),
  'explicit channel member can select authorized channel metadata'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.chat_messages where channel_id = '65000000-0000-4000-8000-000000000001'),
  'explicit channel member can read member-visible messages'
);
insert into public.chat_messages (id, channel_id, sender_user_id, sender_member_id, body) values
  ('66000000-0000-4000-8000-000000000002', '65000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002', 'Member reply');
select pg_temp.assert_true(true, 'explicit channel member can post into own channel');
select pg_temp.assert_true(
  (select count(*) = 1 from public.chat_channel_members where channel_id = '65000000-0000-4000-8000-000000000001'),
  'channel member sees only own membership row'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  exists (select 1 from public.chat_channels where id = '65000000-0000-4000-8000-000000000001'),
  'authorized church admin can select channel metadata'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  exists (select 1 from public.chat_channels where id = '65000000-0000-4000-8000-000000000001'),
  'authorized community leader can select community channel metadata'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  not exists (select 1 from public.chat_channels where id = '65000000-0000-4000-8000-000000000001'),
  'unrelated same-church member cannot select private channel metadata'
);
select pg_temp.assert_true(
  not exists (select 1 from public.chat_messages where channel_id = '65000000-0000-4000-8000-000000000001'),
  'unrelated same-church member cannot read private channel messages'
);
select pg_temp.assert_raises_rls(
  $$insert into public.chat_messages (channel_id, sender_user_id, sender_member_id, body) values (
    '65000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000003',
    '63000000-0000-4000-8000-000000000003',
    'Unauthorized post'
  )$$,
  'unrelated same-church member cannot post into private channel'
);
select pg_temp.assert_true(
  not exists (select 1 from public.chat_channel_members where channel_id = '65000000-0000-4000-8000-000000000001'),
  'unrelated same-church member cannot enumerate channel memberships'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000006', true);
select pg_temp.assert_true(
  not exists (select 1 from public.chat_channels where id = '65000000-0000-4000-8000-000000000001'),
  'cross-church member cannot select private channel metadata'
);
select pg_temp.assert_true(
  not exists (select 1 from public.chat_messages where channel_id = '65000000-0000-4000-8000-000000000001'),
  'cross-church member cannot read private channel messages'
);
select pg_temp.assert_raises_rls(
  $$insert into public.chat_messages (channel_id, sender_user_id, sender_member_id, body) values (
    '65000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000006',
    '63000000-0000-4000-8000-000000000006',
    'Cross-church post'
  )$$,
  'cross-church member cannot post into private channel'
);

reset role;

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_channels'
      and policyname = 'chat channels same church'
  ),
  'overbroad same-church channel metadata policy is absent'
);
select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_channels'
      and policyname = 'Users can view accessible chat channels'
  ),
  'explicit authorized channel metadata policy remains present'
);

rollback;
