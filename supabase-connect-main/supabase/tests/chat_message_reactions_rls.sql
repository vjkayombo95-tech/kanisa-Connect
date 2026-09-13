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

create or replace function pg_temp.assert_raises(_sql text, _label text)
returns void language plpgsql as $$
begin
  begin
    execute _sql;
    raise exception 'FAIL: %', _label;
  exception
    when insufficient_privilege
      or check_violation
      or unique_violation
      or foreign_key_violation then
      raise notice 'PASS: %', _label;
  end;
end;
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('71000000-0000-4000-8000-000000000001', 'reaction-creator@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('71000000-0000-4000-8000-000000000002', 'reaction-member@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('71000000-0000-4000-8000-000000000003', 'reaction-unrelated@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('71000000-0000-4000-8000-000000000004', 'reaction-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('71000000-0000-4000-8000-000000000005', 'reaction-foreign@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, owner_id, created_by) values
  ('72000000-0000-4000-8000-000000000001', 'Reaction RLS Church A', 'reaction-rls-a', '71000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004'),
  ('72000000-0000-4000-8000-000000000002', 'Reaction RLS Church B', 'reaction-rls-b', '71000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000005');

insert into public.members (id, church_id, user_id, full_name, status) values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Reaction Creator', 'active'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'Reaction Member', 'active'),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000003', 'Unrelated Member', 'active'),
  ('73000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000004', 'Reaction Admin', 'active'),
  ('73000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000005', 'Foreign Member', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'member'),
  ('71000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'member'),
  ('71000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', 'member'),
  ('71000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000001', 'church_admin'),
  ('71000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000002', 'member');

insert into public.chat_channels (
  id,
  church_id,
  name,
  description,
  owner_scope,
  audience_type,
  metadata,
  created_by
) values (
  '75000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001',
  'Reaction Private Channel',
  'Sensitive reactions channel',
  'church_admin',
  'admin_roles',
  '{"sensitive":"reaction-metadata"}',
  '71000000-0000-4000-8000-000000000004'
);

insert into public.chat_channel_members (channel_id, user_id, member_id) values
  ('75000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001'),
  ('75000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002');

insert into public.chat_messages (
  id,
  channel_id,
  sender_user_id,
  sender_member_id,
  body
) values (
  '76000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  'Private reaction message'
);

insert into public.chat_message_reactions (message_id, user_id, emoji) values
  ('76000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'pray');

set local role authenticated;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  exists (
    select 1
    from public.chat_message_reactions
    where message_id = '76000000-0000-4000-8000-000000000001'
      and user_id = '71000000-0000-4000-8000-000000000001'
  ),
  'authorized member can read reactions in own channel'
);
insert into public.chat_message_reactions (message_id, user_id, emoji) values
  ('76000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'heart');
select pg_temp.assert_true(true, 'authorized member can insert own reaction');
select pg_temp.assert_raises(
  $$insert into public.chat_message_reactions (message_id, user_id, emoji) values (
    '76000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    'thumb'
  )$$,
  'cannot insert reaction as another user'
);
update public.chat_message_reactions
set emoji = 'thumb'
where message_id = '76000000-0000-4000-8000-000000000001'
  and user_id = '71000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(
  exists (
    select 1
    from public.chat_message_reactions
    where message_id = '76000000-0000-4000-8000-000000000001'
      and user_id = '71000000-0000-4000-8000-000000000002'
      and emoji = 'thumb'
  ),
  'own reaction can be updated/replaced'
);
update public.chat_message_reactions
set emoji = 'fire'
where message_id = '76000000-0000-4000-8000-000000000001'
  and user_id = '71000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  exists (
    select 1
    from public.chat_message_reactions
    where message_id = '76000000-0000-4000-8000-000000000001'
      and user_id = '71000000-0000-4000-8000-000000000001'
      and emoji = 'pray'
  ),
  'cannot update another user reaction'
);
select pg_temp.assert_raises(
  $$insert into public.chat_message_reactions (message_id, user_id, emoji) values (
    '76000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002',
    'smile'
  )$$,
  'primary key prevents multiple reactions for same user and message'
);
select pg_temp.assert_raises(
  $$update public.chat_message_reactions
    set emoji = 'this-is-too-long'
    where message_id = '76000000-0000-4000-8000-000000000001'
      and user_id = '71000000-0000-4000-8000-000000000002'$$,
  'emoji length constraint works'
);
delete from public.chat_message_reactions
where message_id = '76000000-0000-4000-8000-000000000001'
  and user_id = '71000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(
  not exists (
    select 1
    from public.chat_message_reactions
    where message_id = '76000000-0000-4000-8000-000000000001'
      and user_id = '71000000-0000-4000-8000-000000000002'
  ),
  'own reaction can be deleted'
);
delete from public.chat_message_reactions
where message_id = '76000000-0000-4000-8000-000000000001'
  and user_id = '71000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  exists (
    select 1
    from public.chat_message_reactions
    where message_id = '76000000-0000-4000-8000-000000000001'
      and user_id = '71000000-0000-4000-8000-000000000001'
  ),
  'cannot delete another user reaction'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  not exists (
    select 1
    from public.chat_message_reactions
    where message_id = '76000000-0000-4000-8000-000000000001'
  ),
  'unauthorized same-church member cannot read reactions'
);
select pg_temp.assert_raises(
  $$insert into public.chat_message_reactions (message_id, user_id, emoji) values (
    '76000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000003',
    'pray'
  )$$,
  'cannot react to unauthorized channel message'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  not exists (
    select 1
    from public.chat_message_reactions
    where message_id = '76000000-0000-4000-8000-000000000001'
  ),
  'cross-church member cannot read reactions'
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
  'channel metadata hardening remains preserved'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_message_reactions'
      and policyname = 'Users can view chat reactions'
  ),
  'chat reaction select policy exists'
);

delete from public.chat_messages
where id = '76000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  not exists (
    select 1
    from public.chat_message_reactions
    where message_id = '76000000-0000-4000-8000-000000000001'
  ),
  'message deletion cascades reactions'
);

rollback;
