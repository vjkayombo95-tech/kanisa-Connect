-- Local/staging-safe Prayer Library RLS validation.
-- All fixtures and mutations are rolled back at the end.
\set ON_ERROR_STOP on
begin;

create schema if not exists prayer_test;
create or replace function prayer_test.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;
grant usage on schema prayer_test to anon, authenticated;
grant execute on function prayer_test.assert_true(boolean, text) to anon, authenticated;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'prayer-member-a@test.invalid', '', now(), '{}', '{}', now(), now()),
  ('b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'prayer-member-b@test.invalid', '', now(), '{}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'prayer-admin-a@test.invalid', '', now(), '{}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'prayer-admin-b@test.invalid', '', now(), '{}', '{}', now(), now()),
  ('f0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'prayer-super@test.invalid', '', now(), '{}', '{}', now(), now());

insert into public.churches (id, name, slug, church_code)
values
  ('ca000000-0000-4000-8000-000000000001', 'Prayer Test Church A', 'prayer-test-church-a', 'KC-TST-CHA-001'),
  ('cb000000-0000-4000-8000-000000000002', 'Prayer Test Church B', 'prayer-test-church-b', 'KC-TST-CHB-002');

insert into public.user_roles (user_id, role, church_id)
values
  ('a0000000-0000-4000-8000-000000000001', 'member', 'ca000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'member', 'cb000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000003', 'church_admin', 'ca000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000004', 'church_admin', 'cb000000-0000-4000-8000-000000000002');
insert into public.super_admins (id) values ('f0000000-0000-4000-8000-000000000005');

insert into public.content_prayers
  (id, prayer_code, title, slug, body, status, visibility, prayer_type, is_global, church_id)
values
  ('10000000-0000-4000-8000-000000000001', 'test-global-published', 'Test Global Published', 'test-global-published', 'Reviewed global body', 'published', 'member', 'single', true, null),
  ('10000000-0000-4000-8000-000000000002', 'test-global-draft', 'Test Global Draft', 'test-global-draft', null, 'draft', 'member', 'single', true, null),
  ('10000000-0000-4000-8000-000000000003', 'test-a-published', 'Test A Published', 'test-a-published', 'Reviewed A body', 'published', 'member', 'single', false, 'ca000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000004', 'test-a-draft', 'Test A Draft', 'test-a-draft', null, 'draft', 'member', 'single', false, 'ca000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000005', 'test-a-archived', 'Test A Archived', 'test-a-archived', 'Archived body', 'archived', 'member', 'single', false, 'ca000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000006', 'test-b-published', 'Test B Published', 'test-b-published', 'Reviewed B body', 'published', 'member', 'single', false, 'cb000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000007', 'test-b-draft', 'Test B Draft', 'test-b-draft', null, 'draft', 'member', 'single', false, 'cb000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000008', 'test-global-collection', 'Test Global Collection', 'test-global-collection', 'Collection introduction', 'published', 'member', 'collection', true, null),
  ('10000000-0000-4000-8000-000000000009', 'test-global-child', 'Test Global Child', 'test-global-child', 'Child body', 'published', 'member', 'section', true, null);
update public.content_prayers set parent_prayer_id = '10000000-0000-4000-8000-000000000008' where id = '10000000-0000-4000-8000-000000000009';

-- Anonymous users have no authenticated policy.
set local role anon;
set local request.jwt.claim.sub = '';
select prayer_test.assert_true((select count(*) = 0 from public.content_prayers where prayer_code like 'test-%'), 'anonymous user read protected prayers');
reset role;

-- Church A member reads global/A published records and their published child, never B/draft/archived.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';
select prayer_test.assert_true((select count(*) = 1 from public.content_prayers where prayer_code = 'test-global-published'), 'member A cannot read published global prayer');
select prayer_test.assert_true((select count(*) = 1 from public.content_prayers where prayer_code = 'test-a-published'), 'member A cannot read Church A prayer');
select prayer_test.assert_true((select count(*) = 0 from public.content_prayers where prayer_code = 'test-b-published'), 'member A read Church B prayer');
select prayer_test.assert_true((select count(*) = 0 from public.content_prayers where prayer_code in ('test-global-draft','test-a-draft')), 'member A read draft prayer');
select prayer_test.assert_true((select count(*) = 0 from public.content_prayers where prayer_code = 'test-a-archived'), 'member A read archived prayer');
select prayer_test.assert_true((select count(*) = 1 from public.content_prayers where prayer_code = 'test-global-child'), 'member A cannot read published collection child');

-- Favorites are private and unique.
insert into public.prayer_favorites(user_id, prayer_id) values ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
do $$ begin
  begin
    insert into public.prayer_favorites(user_id, prayer_id) values ('b0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');
    raise exception 'ASSERTION FAILED: member inserted another user favorite';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.prayer_favorites(user_id, prayer_id) values ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
    raise exception 'ASSERTION FAILED: duplicate favorite accepted';
  exception when unique_violation then null; end;
end $$;
select prayer_test.assert_true((select count(*) = 1 from public.prayer_favorites), 'member cannot read own favorite');

-- Reading RPC is atomic, private, and refuses inaccessible prayer IDs.
select public.record_prayer_read('10000000-0000-4000-8000-000000000001');
select public.record_prayer_read('10000000-0000-4000-8000-000000000001');
select prayer_test.assert_true((select read_count = 2 from public.prayer_reading_history where prayer_id = '10000000-0000-4000-8000-000000000001'), 'reading count did not increment atomically');
do $$ begin
  begin
    perform public.record_prayer_read('10000000-0000-4000-8000-000000000006');
    raise exception 'ASSERTION FAILED: RPC recorded inaccessible prayer';
  exception when insufficient_privilege then null; end;
  begin
    update public.prayer_reading_history set user_id = 'b0000000-0000-4000-8000-000000000002';
    raise exception 'ASSERTION FAILED: member changed history ownership';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Church B member receives the symmetric tenant boundary.
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000002';
select prayer_test.assert_true((select count(*) = 1 from public.content_prayers where prayer_code = 'test-b-published'), 'member B cannot read Church B prayer');
select prayer_test.assert_true((select count(*) = 0 from public.content_prayers where prayer_code = 'test-a-published'), 'member B read Church A prayer');
reset role;

-- Church A administrator owns Church A mutations only.
set local role authenticated;
set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000003';
insert into public.content_prayers
  (id, prayer_code, title, slug, body, status, visibility, is_global, church_id, created_by)
values
  ('20000000-0000-4000-8000-000000000001', 'test-admin-a-created', 'Admin A Created', 'test-admin-a-created', null, 'draft', 'member', false, 'ca000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003');
update public.content_prayers set summary = 'Admin A edit' where id = '20000000-0000-4000-8000-000000000001';
select prayer_test.assert_true((select summary = 'Admin A edit' from public.content_prayers where id = '20000000-0000-4000-8000-000000000001'), 'admin A cannot edit Church A prayer');
do $$ begin
  begin
    update public.content_prayers set summary = 'forbidden' where id = '10000000-0000-4000-8000-000000000006';
    if found then raise exception 'ASSERTION FAILED: admin A edited Church B prayer'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.content_prayers set summary = 'forbidden' where id = '10000000-0000-4000-8000-000000000001';
    if found then raise exception 'ASSERTION FAILED: admin A edited global prayer'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.content_prayers (title, slug, body, status, is_global, church_id, created_by)
    values ('Forbidden global', 'test-forbidden-global', null, 'draft', true, null, 'a1000000-0000-4000-8000-000000000003');
    raise exception 'ASSERTION FAILED: admin A created global prayer';
  exception when insufficient_privilege then null; end;
  begin
    update public.content_prayers set status = 'published' where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'ASSERTION FAILED: admin published empty prayer';
  exception when check_violation then null; end;
end $$;
update public.content_prayers set body = 'Reviewed parish body', status = 'published' where id = '20000000-0000-4000-8000-000000000001';
select prayer_test.assert_true((select status = 'published' from public.content_prayers where id = '20000000-0000-4000-8000-000000000001'), 'admin cannot publish prayer with body');
reset role;

-- Church B administrator can create B content but cannot see or mutate Church A drafts.
set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-000000000004';
select prayer_test.assert_true((select count(*) = 0 from public.content_prayers where prayer_code = 'test-a-draft'), 'admin B read Church A draft');
insert into public.content_prayers
  (id, prayer_code, title, slug, body, status, visibility, is_global, church_id, created_by)
values
  ('20000000-0000-4000-8000-000000000002', 'test-admin-b-created', 'Admin B Created', 'test-admin-b-created', null, 'draft', 'member', false, 'cb000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004');
do $$ begin
  update public.content_prayers set summary = 'forbidden' where id = '10000000-0000-4000-8000-000000000004';
  if found then raise exception 'ASSERTION FAILED: admin B edited Church A draft'; end if;
end $$;
reset role;

-- Super admin manages globals but cannot bypass publication-body validation.
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000005';
insert into public.content_prayers
  (id, prayer_code, title, slug, body, status, visibility, is_global, church_id, created_by)
values
  ('30000000-0000-4000-8000-000000000001', 'test-super-global', 'Super Global', 'test-super-global', 'Reviewed super body', 'published', 'member', true, null, 'f0000000-0000-4000-8000-000000000005');
do $$ begin
  begin
    insert into public.content_prayers (title, slug, body, status, visibility, is_global, church_id, created_by)
    values ('Invalid Super Global', 'test-invalid-super-global', null, 'published', 'member', true, null, 'f0000000-0000-4000-8000-000000000005');
    raise exception 'ASSERTION FAILED: super admin published empty global prayer';
  exception when check_violation then null; end;
end $$;

-- Parent ownership, type, cycle, and cascade validation.
insert into public.content_prayers
  (id, prayer_code, title, slug, body, status, prayer_type, visibility, is_global, church_id)
values
  ('40000000-0000-4000-8000-000000000001', 'test-parent-a', 'Parent A', 'test-parent-a', null, 'draft', 'collection', 'member', false, 'ca000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', 'test-parent-b', 'Parent B', 'test-parent-b', null, 'draft', 'collection', 'member', false, 'cb000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000003', 'test-parent-global-a', 'Global Parent A', 'test-parent-global-a', null, 'draft', 'collection', 'member', true, null),
  ('40000000-0000-4000-8000-000000000004', 'test-parent-global-b', 'Global Parent B', 'test-parent-global-b', null, 'draft', 'collection', 'member', true, null),
  ('40000000-0000-4000-8000-000000000005', 'test-not-collection', 'Not Collection', 'test-not-collection', null, 'draft', 'single', 'member', true, null),
  ('40000000-0000-4000-8000-000000000006', 'test-cascade-child', 'Cascade Child', 'test-cascade-child', null, 'draft', 'section', 'member', true, null);
update public.content_prayers set parent_prayer_id = '40000000-0000-4000-8000-000000000003' where id = '40000000-0000-4000-8000-000000000006';
do $$ begin
  begin
    update public.content_prayers set parent_prayer_id = '40000000-0000-4000-8000-000000000002' where id = '40000000-0000-4000-8000-000000000001';
    raise exception 'ASSERTION FAILED: Church A parent attached to Church B parent';
  exception when check_violation then null; end;
  begin
    update public.content_prayers set parent_prayer_id = '40000000-0000-4000-8000-000000000003' where id = '40000000-0000-4000-8000-000000000001';
    raise exception 'ASSERTION FAILED: parish prayer attached to global parent';
  exception when check_violation then null; end;
  begin
    update public.content_prayers set parent_prayer_id = '40000000-0000-4000-8000-000000000005' where id = '40000000-0000-4000-8000-000000000004';
    raise exception 'ASSERTION FAILED: prayer attached to non-collection parent';
  exception when check_violation then null; end;
end $$;
update public.content_prayers set parent_prayer_id = '40000000-0000-4000-8000-000000000003' where id = '40000000-0000-4000-8000-000000000004';
do $$ begin
  begin
    update public.content_prayers set parent_prayer_id = '40000000-0000-4000-8000-000000000004' where id = '40000000-0000-4000-8000-000000000003';
    raise exception 'ASSERTION FAILED: cyclic parent relationship accepted';
  exception when check_violation then null; end;
end $$;
delete from public.content_prayers where id = '40000000-0000-4000-8000-000000000003';
select prayer_test.assert_true((select count(*) = 0 from public.content_prayers where id in ('40000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000006')), 'parent delete did not cascade to children');
reset role;

rollback;
\echo 'Prayer Library SQL RLS matrix passed'
