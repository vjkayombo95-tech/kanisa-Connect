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
  ('45000000-0000-4000-8000-000000000001', 'announcement-leader-a@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('45000000-0000-4000-8000-000000000002', 'announcement-member-a@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('45000000-0000-4000-8000-000000000003', 'announcement-leader-b@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug) values
  ('45100000-0000-4000-8000-000000000001', 'Announcement Leader Church A', 'announcement-leader-contract-a'),
  ('45100000-0000-4000-8000-000000000002', 'Announcement Leader Church B', 'announcement-leader-contract-b');

insert into public.members (id, full_name, email, church_id, user_id, status) values
  ('45200000-0000-4000-8000-000000000001', 'Leader A', 'announcement-leader-a@test.invalid', '45100000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001', 'active'),
  ('45200000-0000-4000-8000-000000000002', 'Member A', 'announcement-member-a@test.invalid', '45100000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000002', 'active'),
  ('45200000-0000-4000-8000-000000000003', 'Leader B', 'announcement-leader-b@test.invalid', '45100000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-000000000003', 'active');

insert into public.communities (id, church_id, name, mwenyekiti_id) values
  ('45300000-0000-4000-8000-000000000001', '45100000-0000-4000-8000-000000000001', 'Jumuiya A', '45200000-0000-4000-8000-000000000001'),
  ('45300000-0000-4000-8000-000000000002', '45100000-0000-4000-8000-000000000002', 'Jumuiya B', '45200000-0000-4000-8000-000000000003');

insert into public.member_communities (member_id, community_id) values
  ('45200000-0000-4000-8000-000000000001', '45300000-0000-4000-8000-000000000001'),
  ('45200000-0000-4000-8000-000000000002', '45300000-0000-4000-8000-000000000001'),
  ('45200000-0000-4000-8000-000000000003', '45300000-0000-4000-8000-000000000002');

insert into public.announcements
  (id, church_id, title, content, is_published, published_at, created_by, created_at, status, publish_at, never_expires, audience, target_community, community_audience)
values
  ('45400000-0000-4000-8000-000000000001', '45100000-0000-4000-8000-000000000001', 'All Community Leaders', 'Visible to church leaders', true, now(), '45000000-0000-4000-8000-000000000001', now(), 'active', now(), true, array['community_leaders'], null, 'all'),
  ('45400000-0000-4000-8000-000000000002', '45100000-0000-4000-8000-000000000001', 'Everyone', 'Visible to everyone', true, now(), '45000000-0000-4000-8000-000000000001', now(), 'active', now(), true, array['everyone'], null, 'all'),
  ('45400000-0000-4000-8000-000000000003', '45100000-0000-4000-8000-000000000001', 'Specific Community Leaders', 'Visible to one community leaders', true, now(), '45000000-0000-4000-8000-000000000001', now(), 'active', now(), true, array['everyone'], 'Jumuiya A', 'leaders');

set local role authenticated;
set local request.jwt.claim.sub = '45000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  exists (
    select 1 from public.get_portal_announcements('45100000-0000-4000-8000-000000000001', 50)
    where id = '45400000-0000-4000-8000-000000000001'
  ),
  'same-church community leader sees church-wide community leader announcement'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.get_portal_announcements('45100000-0000-4000-8000-000000000001', 50)
    where id = '45400000-0000-4000-8000-000000000003'
  ),
  'existing specific-community leaders-only announcement still works'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '45000000-0000-4000-8000-000000000002';

select pg_temp.assert_true(
  not exists (
    select 1 from public.get_portal_announcements('45100000-0000-4000-8000-000000000001', 50)
    where id = '45400000-0000-4000-8000-000000000001'
  ),
  'ordinary member does not see church-wide community leader announcement'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.get_portal_announcements('45100000-0000-4000-8000-000000000001', 50)
    where id = '45400000-0000-4000-8000-000000000002'
  ),
  'existing everyone announcement remains visible to ordinary member'
);

select pg_temp.assert_true(
  not exists (
    select 1 from public.get_portal_announcements('45100000-0000-4000-8000-000000000001', 50)
    where id = '45400000-0000-4000-8000-000000000003'
  ),
  'ordinary community member does not see existing leaders-only community announcement'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '45000000-0000-4000-8000-000000000003';

select pg_temp.assert_true(
  not exists (
    select 1 from public.get_portal_announcements('45100000-0000-4000-8000-000000000001', 50)
    where id = '45400000-0000-4000-8000-000000000001'
  ),
  'other-church community leader does not see church-wide community leader announcement'
);

rollback;
