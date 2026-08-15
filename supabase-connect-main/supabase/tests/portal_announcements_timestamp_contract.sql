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
  ('41000000-0000-4000-8000-000000000001', 'announcement-a@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('41000000-0000-4000-8000-000000000002', 'announcement-b@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug) values
  ('42000000-0000-4000-8000-000000000001', 'Announcement Church A', 'announcement-contract-a'),
  ('42000000-0000-4000-8000-000000000002', 'Announcement Church B', 'announcement-contract-b');

insert into public.user_roles (user_id, church_id, role) values
  ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'member'),
  ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'member');

insert into public.announcements
  (id, church_id, title, content, is_published, published_at, created_by, created_at, status, publish_at, never_expires, audience)
values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Published A', 'Visible A', true, '2026-08-15 10:00:00', '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', 'active', '2026-08-15 10:00:00+00', true, array['everyone']),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'Published B', 'Foreign B', true, '2026-08-15 10:00:00', '41000000-0000-4000-8000-000000000002', '2026-08-15 09:00:00', 'active', '2026-08-15 10:00:00+00', true, array['everyone']),
  ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000001', 'Draft A', 'Hidden A', false, null, '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', 'draft', null, true, array['everyone']);

set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  (select count(*) = 1 from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)),
  'published own-church announcement returns successfully'
);

select pg_temp.assert_true(
  (select pg_typeof(published_at)::text = 'timestamp with time zone'
     and pg_typeof(created_at)::text = 'timestamp with time zone'
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)
   limit 1),
  'legacy timestamps conform to timestamptz result columns'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.get_portal_announcements('42000000-0000-4000-8000-000000000002', 50)),
  'foreign-church announcements are unavailable'
);

reset role;
delete from public.announcements where church_id = '42000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-4000-8000-000000000002';

select pg_temp.assert_true(
  (select count(*) = 0 from public.get_portal_announcements('42000000-0000-4000-8000-000000000002', 50)),
  'authorized empty result returns safely'
);

rollback;
