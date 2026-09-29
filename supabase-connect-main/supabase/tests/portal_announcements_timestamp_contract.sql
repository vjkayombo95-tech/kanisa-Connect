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
  ('41000000-0000-4000-8000-000000000002', 'announcement-b@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('41000000-0000-4000-8000-000000000003', 'announcement-empty@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug) values
  ('42000000-0000-4000-8000-000000000001', 'Announcement Church A', 'announcement-contract-a'),
  ('42000000-0000-4000-8000-000000000002', 'Announcement Church B', 'announcement-contract-b'),
  ('42000000-0000-4000-8000-000000000003', 'Announcement Empty Church', 'announcement-contract-empty');

insert into public.user_roles (user_id, church_id, role) values
  ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'member'),
  ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'member'),
  ('41000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000003', 'member');

insert into public.announcements
  (id, church_id, title, content, is_published, published_at, created_by, created_at, archived_at, status, publish_at, expires_at, never_expires, audience)
values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Published A', 'Visible A', true, '2026-08-15 10:00:00', '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', null, 'active', '2026-08-15 10:00:00+00', null, true, array['everyone']),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'Published B', 'Foreign B', true, '2026-08-15 10:00:00', '41000000-0000-4000-8000-000000000002', '2026-08-15 09:00:00', null, 'active', '2026-08-15 10:00:00+00', null, true, array['everyone']),
  ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000001', 'Draft A', 'Hidden A', false, null, '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', null, 'draft', null, null, true, array['everyone']),
  ('43000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000001', 'Future Scheduled A', 'Hidden future', false, null, '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', null, 'scheduled', now() + interval '1 day', null, true, array['everyone']),
  ('43000000-0000-4000-8000-000000000005', '42000000-0000-4000-8000-000000000001', 'Expired A', 'Hidden expired', true, '2026-08-15 10:00:00', '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', null, 'expired', '2026-08-15 10:00:00+00', now() - interval '1 day', false, array['everyone']),
  ('43000000-0000-4000-8000-000000000006', '42000000-0000-4000-8000-000000000001', 'Archived A', 'Hidden archived', true, '2026-08-15 10:00:00', '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', now(), 'archived', '2026-08-15 10:00:00+00', null, true, array['everyone']),
  ('43000000-0000-4000-8000-000000000007', '42000000-0000-4000-8000-000000000001', 'Treasurer Audience A', 'Hidden audience', true, '2026-08-15 10:00:00', '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', null, 'active', '2026-08-15 10:00:00+00', null, true, array['treasurer']);

alter table public.announcements disable trigger sync_announcement_lifecycle_fields;

insert into public.announcements
  (id, church_id, title, content, is_published, published_at, created_by, created_at, archived_at, status, publish_at, expires_at, never_expires, audience)
values
  ('43000000-0000-4000-8000-000000000008', '42000000-0000-4000-8000-000000000001', 'Due Scheduled A', 'Visible due scheduled', false, null, '41000000-0000-4000-8000-000000000001', '2026-08-15 09:00:00', null, 'scheduled', now() - interval '1 minute', null, true, array['members']);

alter table public.announcements enable trigger sync_announcement_lifecycle_fields;

set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  (select count(*) = 2
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)),
  'member without announcements publish permission can read visible own-church announcements'
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)
   where title = 'Published A'),
  'published announcement is visible'
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)
   where title = 'Due Scheduled A'
     and is_published = true
     and status = 'active'),
  'due scheduled announcement is visible with derived publication state'
);

select pg_temp.assert_true(
  (select count(*) = 0
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)
   where title = 'Future Scheduled A'),
  'future scheduled announcement is hidden'
);

select pg_temp.assert_true(
  (select count(*) = 0
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)
   where title = 'Expired A'),
  'expired announcement is hidden'
);

select pg_temp.assert_true(
  (select count(*) = 0
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)
   where title = 'Archived A'),
  'archived announcement is hidden'
);

select pg_temp.assert_true(
  (select count(*) = 0
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)
   where title = 'Treasurer Audience A'),
  'role-only audience announcement is hidden from ordinary member'
);

-- Inspect the stored scheduled row outside member RLS.
-- The portal read above must not have mutated it.
reset role;

select pg_temp.assert_true(
  (select is_published = false
          and status = 'scheduled'
          and published_at is null
   from public.announcements
   where id = '43000000-0000-4000-8000-000000000008'),
  'portal read does not mutate due scheduled lifecycle fields'
);

-- Restore member context for the remaining member-facing assertions.
set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  (select pg_typeof(published_at)::text = 'timestamp with time zone'
          and pg_typeof(created_at)::text = 'timestamp with time zone'
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000001', 50)
   limit 1),
  'legacy timestamps conform to timestamptz result columns'
);

select pg_temp.assert_true(
  (select count(*) = 0
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000002', 50)),
  'foreign-church announcements are unavailable'
);

-- Use a separate authorized church with no announcements for the empty-state test.
-- This avoids deleting announcement data or bypassing mutation permissions.
set local request.jwt.claim.sub = '41000000-0000-4000-8000-000000000003';

select pg_temp.assert_true(
  (select count(*) = 0
   from public.get_portal_announcements('42000000-0000-4000-8000-000000000003', 50)),
  'authorized empty result returns safely'
);

rollback;