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

create or replace function pg_temp.assert_false(_condition boolean, _label text)
returns void language plpgsql as $$
begin
  if coalesce(_condition, false) then
    raise exception 'FAIL: %', _label;
  end if;
  raise notice 'PASS: %', _label;
end;
$$;

create or replace function pg_temp.assert_raises(_sql text, _label text)
returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'FAIL: %', _label;
exception
  when others then
    raise notice 'PASS: %', _label;
end;
$$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5a-diocese-a-manager@test.invalid', '', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5a-diocese-b-manager@test.invalid', '', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5a-diocese-a-viewer@test.invalid', '', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5a-inactive-staff@test.invalid', '', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5a-parish-admin@test.invalid', '', now(), now(), now()),
  ('b1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5a-ordinary@test.invalid', '', now(), now(), now());

insert into public.churches (id, name, slug, code, created_by)
values
  ('b2000000-0000-4000-8000-000000000001', 'Slice 5A Parish A', 'slice-5a-parish-a', 'S5A-A', 'b1000000-0000-4000-8000-000000000005'),
  ('b2000000-0000-4000-8000-000000000002', 'Slice 5A Parish B', 'slice-5a-parish-b', 'S5A-B', 'b1000000-0000-4000-8000-000000000006'),
  ('b2000000-0000-4000-8000-000000000003', 'Slice 5A Inactive Parish', 'slice-5a-inactive-parish', 'S5A-I', 'b1000000-0000-4000-8000-000000000006'),
  ('b2000000-0000-4000-8000-000000000004', 'Slice 5A Later Ended Parish', 'slice-5a-later-ended-parish', 'S5A-E', 'b1000000-0000-4000-8000-000000000006');

insert into public.user_roles (id, user_id, church_id, role)
values (
  'b6000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'b2000000-0000-4000-8000-000000000001',
  'church_admin'
);

insert into public.dioceses (id, name, slug, status, created_by)
values
  ('b3000000-0000-4000-8000-000000000001', 'Slice 5A Diocese A', 'slice-5a-diocese-a', 'active', 'b1000000-0000-4000-8000-000000000001'),
  ('b3000000-0000-4000-8000-000000000002', 'Slice 5A Diocese B', 'slice-5a-diocese-b', 'active', 'b1000000-0000-4000-8000-000000000002');

insert into public.diocese_churches (id, diocese_id, church_id, status, added_by)
values
  ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'active', 'b1000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'active', 'b1000000-0000-4000-8000-000000000002'),
  ('b4000000-0000-4000-8000-000000000003', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000003', 'inactive', 'b1000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000004', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000004', 'active', 'b1000000-0000-4000-8000-000000000001');

insert into public.diocese_staff (id, diocese_id, user_id, role, status)
values
  ('b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'diocese_admin', 'active'),
  ('b5000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'diocese_admin', 'active'),
  ('b5000000-0000-4000-8000-000000000003', 'b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'diocese_staff', 'active'),
  ('b5000000-0000-4000-8000-000000000004', 'b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', 'diocese_admin', 'inactive');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice5a-diocese-a-manager@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5a-diocese-a-manager@test.invalid"}', true);

select public.save_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  null,
  'Diocese A Draft',
  'Content for Diocese A',
  'draft',
  'all_parishes',
  '{}'::uuid[]
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_diocese_announcements('b3000000-0000-4000-8000-000000000001')
    where title = 'Diocese A Draft'
      and status = 'draft'
      and target_mode = 'all_parishes'
  ),
  'Diocese A manager can create and read Diocese A draft'
);

select pg_temp.assert_false(
  exists (select 1 from public.get_diocese_announcements('b3000000-0000-4000-8000-000000000002')),
  'Diocese A manager cannot read Diocese B announcements'
);

select pg_temp.assert_raises(
  'select public.save_diocese_announcement(''b3000000-0000-4000-8000-000000000002'', null, ''Bad'', ''Bad'', ''draft'', ''all_parishes'', ''{}''::uuid[])',
  'Diocese A manager cannot create Diocese B announcements'
);

select public.save_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  null,
  'Selected Parish Draft',
  'Content for selected parish',
  'draft',
  'selected_parishes',
  array['b2000000-0000-4000-8000-000000000001']::uuid[]
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_diocese_announcements('b3000000-0000-4000-8000-000000000001')
    where title = 'Selected Parish Draft'
      and target_mode = 'selected_parishes'
      and target_count = 1
  ),
  'Selected active parish in the same Diocese succeeds'
);

select public.publish_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  (select id from public.diocese_announcements where title = 'Selected Parish Draft')
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_announcements
    where title = 'Selected Parish Draft'
      and status = 'published'
      and published_at is not null
  ),
  'Publish selected-parishes announcement with active Diocese-parish target succeeds'
);

select public.save_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  null,
  'Ended Target Draft',
  'Content for stale selected parish',
  'draft',
  'selected_parishes',
  array['b2000000-0000-4000-8000-000000000004']::uuid[]
);

update public.diocese_churches
set status = 'ended', ended_at = now()
where id = 'b4000000-0000-4000-8000-000000000004';

select pg_temp.assert_raises(
  'select public.publish_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', (select id from public.diocese_announcements where title = ''Ended Target Draft''))',
  'Publish selected-parishes announcement rejects a target whose Diocese link later ended'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.diocese_announcements
    where title = 'Ended Target Draft'
      and status = 'published'
  ),
  'Ended target draft remains unpublished after rejected publish'
);

select public.save_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  null,
  'Missing Target Draft',
  'Content for missing selected target',
  'draft',
  'selected_parishes',
  array['b2000000-0000-4000-8000-000000000001']::uuid[]
);

reset role;

delete from public.diocese_announcement_parish_targets
where announcement_id = (select id from public.diocese_announcements where title = 'Missing Target Draft');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice5a-diocese-a-manager@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5a-diocese-a-manager@test.invalid"}', true);

select pg_temp.assert_raises(
  'select public.publish_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', (select id from public.diocese_announcements where title = ''Missing Target Draft''))',
  'Publish selected-parishes announcement rejects an empty selected target set'
);

select public.save_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  null,
  'All Parishes Publish Draft',
  'Content for all parishes publish',
  'draft',
  'all_parishes',
  '{}'::uuid[]
);

select public.publish_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  (select id from public.diocese_announcements where title = 'All Parishes Publish Draft')
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_announcements
    where title = 'All Parishes Publish Draft'
      and status = 'published'
      and published_at is not null
  ),
  'Publish all-parishes announcement does not require selected parish targets'
);

select pg_temp.assert_raises(
  'select public.save_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', null, ''Cross target'', ''Bad target'', ''draft'', ''selected_parishes'', array[''b2000000-0000-4000-8000-000000000002'']::uuid[])',
  'Parish belonging to another Diocese is rejected'
);

select pg_temp.assert_raises(
  'select public.save_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', null, ''Inactive target'', ''Bad target'', ''draft'', ''selected_parishes'', array[''b2000000-0000-4000-8000-000000000003'']::uuid[])',
  'Inactive Diocese-parish link is rejected'
);

select public.publish_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  (select id from public.diocese_announcements where title = 'Diocese A Draft')
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_announcements
    where title = 'Diocese A Draft'
      and status = 'published'
      and published_at is not null
  ),
  'Diocese A manager can publish Diocese A announcement'
);

select public.archive_diocese_announcement(
  'b3000000-0000-4000-8000-000000000001',
  (select id from public.diocese_announcements where title = 'Diocese A Draft')
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_announcements
    where title = 'Diocese A Draft'
      and status = 'archived'
      and archived_at is not null
  ),
  'Diocese A manager can archive Diocese A announcement'
);

select pg_temp.assert_raises(
  'select public.save_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', (select id from public.diocese_announcements where title = ''Diocese A Draft''), ''Restored title'', ''Restored content'', ''published'', ''all_parishes'', ''{}''::uuid[])',
  'Archived Diocese announcements cannot be edited through save RPC'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_announcements
    where title = 'Diocese A Draft'
      and status = 'archived'
      and archived_at is not null
  ),
  'Archived Diocese announcement remains archived after rejected save'
);

select pg_temp.assert_raises(
  'select public.archive_diocese_announcement(''b3000000-0000-4000-8000-000000000002'', (select id from public.diocese_announcements where title = ''Selected Parish Draft''))',
  'Archive action cannot cross Diocese boundaries'
);

select pg_temp.assert_raises(
  'insert into public.diocese_announcement_parish_targets (announcement_id, diocese_id, church_id) values ((select id from public.diocese_announcements where title = ''Selected Parish Draft''), ''b3000000-0000-4000-8000-000000000001'', ''b2000000-0000-4000-8000-000000000002'')',
  'Cross-Diocese target row cannot be inserted directly'
);

select pg_temp.assert_raises(
  'insert into public.diocese_announcement_parish_targets (announcement_id, diocese_id, church_id) values ((select id from public.diocese_announcements where title = ''Selected Parish Draft''), ''b3000000-0000-4000-8000-000000000002'', ''b2000000-0000-4000-8000-000000000002'')',
  'Target row Diocese must match announcement Diocese'
);

select pg_temp.assert_raises(
  'insert into public.diocese_announcement_parish_targets (announcement_id, diocese_id, church_id) values ((select id from public.diocese_announcements where title = ''Selected Parish Draft''), ''b3000000-0000-4000-8000-000000000001'', ''b2000000-0000-4000-8000-000000000003'')',
  'Inactive target row cannot be inserted directly'
);

select pg_temp.assert_false(
  public.is_church_admin('b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001'),
  'Diocese staff remains non-admin for parish church'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.user_roles
    where user_id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000003',
      'b1000000-0000-4000-8000-000000000004'
    )
  ),
  'Creating Diocese announcements creates zero Diocese-staff user_roles'
);

reset role;

select pg_temp.assert_false(
  exists (
    select 1
    from public.church_memberships
    where user_id in (
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000003',
      'b1000000-0000-4000-8000-000000000004'
    )
  ),
  'Creating Diocese announcements creates zero church_memberships'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice5a-diocese-a-manager@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5a-diocese-a-manager@test.invalid"}', true);

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'slice5a-diocese-a-viewer@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5a-diocese-a-viewer@test.invalid"}', true);

select pg_temp.assert_true(
  exists (select 1 from public.get_diocese_announcements('b3000000-0000-4000-8000-000000000001')),
  'Ordinary Diocese viewer can read own Diocese announcements'
);

select pg_temp.assert_raises(
  'select public.save_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', null, ''Viewer Bad'', ''Bad'', ''draft'', ''all_parishes'', ''{}''::uuid[])',
  'Ordinary Diocese viewer cannot create announcements'
);

select pg_temp.assert_raises(
  'select public.publish_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', (select id from public.diocese_announcements where title = ''Ended Target Draft''))',
  'Ordinary Diocese viewer cannot publish announcements'
);

select pg_temp.assert_raises(
  'insert into public.diocese_announcements (diocese_id, title, content, status, target_mode) values (''b3000000-0000-4000-8000-000000000001'', ''Viewer direct insert'', ''Bypass attempt'', ''draft'', ''all_parishes'')',
  'Direct table DML cannot bypass RLS for ordinary Diocese viewer'
);

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.email', 'slice5a-inactive-staff@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5a-inactive-staff@test.invalid"}', true);

select pg_temp.assert_false(
  exists (select 1 from public.get_diocese_announcements('b3000000-0000-4000-8000-000000000001')),
  'Inactive Diocese staff cannot read announcements'
);

select pg_temp.assert_raises(
  'select public.save_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', null, ''Inactive Bad'', ''Bad'', ''draft'', ''all_parishes'', ''{}''::uuid[])',
  'Inactive Diocese staff cannot manage announcements'
);

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.email', 'slice5a-parish-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5a-parish-admin@test.invalid"}', true);

select pg_temp.assert_true(
  public.is_church_admin('b1000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000001'),
  'Parish admin fixture has parish authority'
);

select pg_temp.assert_raises(
  'select public.save_diocese_announcement(''b3000000-0000-4000-8000-000000000001'', null, ''Parish Admin Bad'', ''Bad'', ''draft'', ''all_parishes'', ''{}''::uuid[])',
  'Ordinary parish admin does not gain Diocese announcement management'
);

reset role;

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.get_diocese_announcements(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.save_diocese_announcement(uuid,uuid,text,text,text,text,uuid[])', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.publish_diocese_announcement(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.archive_diocese_announcement(uuid,uuid)', 'EXECUTE'),
  'authenticated can execute intended public Diocese announcement RPCs'
);

select pg_temp.assert_false(
  has_function_privilege('anon', 'public.save_diocese_announcement(uuid,uuid,text,text,text,text,uuid[])', 'EXECUTE')
    or has_function_privilege('anon', 'public.publish_diocese_announcement(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.archive_diocese_announcement(uuid,uuid)', 'EXECUTE'),
  'anon cannot execute management RPCs'
);

select pg_temp.assert_false(
  has_table_privilege('authenticated', 'public.diocese_announcement_parish_targets', 'INSERT')
    or has_table_privilege('authenticated', 'public.diocese_announcement_parish_targets', 'UPDATE')
    or has_table_privilege('authenticated', 'public.diocese_announcement_parish_targets', 'DELETE'),
  'authenticated cannot directly mutate Diocese announcement parish targets'
);

select pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.diocese_announcement_parish_targets', 'SELECT'),
  'authenticated retains select on Diocese announcement parish targets'
);

select pg_temp.assert_false(
  has_function_privilege('authenticated', 'public.is_diocese_staff(uuid,uuid)', 'EXECUTE'),
  'authenticated still cannot directly execute internal is_diocese_staff(uuid, uuid)'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'diocese_announcements',
        'diocese_announcement_parish_targets'
      )
      and qual like '%current_user_can_view_diocese%'
  ),
  'Diocese announcement read RLS uses Diocese view helper'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'diocese_announcements',
        'diocese_announcement_parish_targets'
      )
      and with_check like '%current_user_can_manage_diocese%'
  ),
  'Diocese announcement write RLS uses Diocese manage helper'
);

select pg_temp.assert_true(
  pg_get_functiondef('public.publish_diocese_announcement(uuid,uuid)'::regprocedure)
    like '%pg_advisory_xact_lock%'
    and pg_get_functiondef('public.publish_diocese_announcement(uuid,uuid)'::regprocedure)
      like '%diocese_announcement_targets:%'
    and pg_get_functiondef('public.publish_diocese_announcement(uuid,uuid)'::regprocedure)
      like '%order by dat.church_id asc, dat.id asc%'
    and pg_get_functiondef('public.publish_diocese_announcement(uuid,uuid)'::regprocedure)
      like '%for update of dat%'
    and pg_get_functiondef('public.publish_diocese_announcement(uuid,uuid)'::regprocedure)
      like '%order by dc.church_id asc, dc.id asc%'
    and pg_get_functiondef('public.publish_diocese_announcement(uuid,uuid)'::regprocedure)
      like '%for update of dc%',
  'Publish RPC uses deterministic row-lock ordering for selected parish targets'
);

select pg_temp.assert_true(
  pg_get_functiondef('public.lock_diocese_announcement_target_mutation()'::regprocedure)
    like '%pg_advisory_xact_lock%'
    and pg_get_functiondef('public.lock_diocese_announcement_target_mutation()'::regprocedure)
      like '%diocese_announcement_targets:%'
    and exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.diocese_announcement_parish_targets'::regclass
        and tgname = 'lock_diocese_announcement_target_mutation_before_write'
        and not tgisinternal
    ),
  'Direct target row writes serialize with publish validation per announcement'
);

rollback;
