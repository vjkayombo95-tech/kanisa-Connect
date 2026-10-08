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
  ('c1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-parish-a-member@test.invalid', '', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-parish-b-member@test.invalid', '', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-multi-member@test.invalid', '', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-diocese-staff@test.invalid', '', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-owner@test.invalid', '', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-canonical-only@test.invalid', '', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-linked-member@test.invalid', '', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-email-only@test.invalid', '', now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice5b-inactive-member@test.invalid', '', now(), now(), now());

insert into public.churches (id, name, slug, code, created_by)
values
  ('c2000000-0000-4000-8000-000000000001', 'Slice 5B Parish A', 'slice-5b-parish-a', 'S5B-A', 'c1000000-0000-4000-8000-000000000005'),
  ('c2000000-0000-4000-8000-000000000002', 'Slice 5B Parish B', 'slice-5b-parish-b', 'S5B-B', 'c1000000-0000-4000-8000-000000000005'),
  ('c2000000-0000-4000-8000-000000000003', 'Slice 5B Inactive Link Parish', 'slice-5b-inactive-link', 'S5B-I', 'c1000000-0000-4000-8000-000000000005'),
  ('c2000000-0000-4000-8000-000000000004', 'Slice 5B Inactive Diocese Parish', 'slice-5b-inactive-diocese', 'S5B-D', 'c1000000-0000-4000-8000-000000000005'),
  ('c2000000-0000-4000-8000-000000000005', 'Slice 5B Other Diocese A Parish', 'slice-5b-other-diocese-a', 'S5B-O', 'c1000000-0000-4000-8000-000000000005');

insert into public.church_memberships (id, user_id, church_id, status, is_primary, membership_source)
values
  ('c7000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'active', true, 'slice5b-test'),
  ('c7000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'active', true, 'slice5b-test'),
  ('c7000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000001', 'active', true, 'slice5b-test'),
  ('c7000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000002', 'active', false, 'slice5b-test'),
  ('c7000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000003', 'active', false, 'slice5b-test'),
  ('c7000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000004', 'active', false, 'slice5b-test'),
  ('c7000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000006', 'c2000000-0000-4000-8000-000000000001', 'active', true, 'slice5b-test');

insert into public.members (id, full_name, email, church_id, user_id, status, membership_id)
values
  ('c8000000-0000-4000-8000-000000000001', 'Slice 5B Parish A Member', 'slice5b-parish-a-member@test.invalid', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'active', 'c7000000-0000-4000-8000-000000000001'),
  ('c8000000-0000-4000-8000-000000000002', 'Slice 5B Parish B Member', 'slice5b-parish-b-member@test.invalid', 'c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'active', 'c7000000-0000-4000-8000-000000000002'),
  ('c8000000-0000-4000-8000-000000000003', 'Slice 5B Linked Member Only', 'slice5b-linked-member@test.invalid', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000007', 'active', null),
  ('c8000000-0000-4000-8000-000000000004', 'Slice 5B Email Match Only', 'slice5b-email-only@test.invalid', 'c2000000-0000-4000-8000-000000000001', null, 'active', null),
  ('c8000000-0000-4000-8000-000000000005', 'Slice 5B Inactive Member Only', 'slice5b-inactive-member@test.invalid', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000009', 'inactive', null);

insert into public.dioceses (id, name, slug, status, created_by)
values
  ('c3000000-0000-4000-8000-000000000001', 'Slice 5B Diocese A', 'slice-5b-diocese-a', 'active', 'c1000000-0000-4000-8000-000000000005'),
  ('c3000000-0000-4000-8000-000000000002', 'Slice 5B Diocese B', 'slice-5b-diocese-b', 'active', 'c1000000-0000-4000-8000-000000000005'),
  ('c3000000-0000-4000-8000-000000000003', 'Slice 5B Inactive Diocese', 'slice-5b-inactive-diocese', 'inactive', 'c1000000-0000-4000-8000-000000000005');

insert into public.diocese_churches (id, diocese_id, church_id, status, added_by)
values
  ('c4000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'active', 'c1000000-0000-4000-8000-000000000005'),
  ('c4000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'active', 'c1000000-0000-4000-8000-000000000005'),
  ('c4000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000003', 'inactive', 'c1000000-0000-4000-8000-000000000005'),
  ('c4000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000004', 'active', 'c1000000-0000-4000-8000-000000000005'),
  ('c4000000-0000-4000-8000-000000000005', 'c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000005', 'active', 'c1000000-0000-4000-8000-000000000005');

insert into public.diocese_staff (id, diocese_id, user_id, role, status)
values
  ('c5000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000004', 'diocese_admin', 'active');

insert into public.diocese_announcements (id, diocese_id, title, content, status, target_mode, published_at, archived_at, created_by, updated_by)
values
  ('c6000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Slice 5B All Parishes', 'All parishes content', 'published', 'all_parishes', now() - interval '1 day', null, 'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005'),
  ('c6000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000001', 'Slice 5B Parish A Selected', 'Parish A selected content', 'published', 'selected_parishes', now(), null, 'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005'),
  ('c6000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000002', 'Slice 5B Parish B Selected', 'Parish B selected content', 'published', 'selected_parishes', now(), null, 'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005'),
  ('c6000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000001', 'Slice 5B Draft Excluded', 'Draft content', 'draft', 'all_parishes', null, null, 'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005'),
  ('c6000000-0000-4000-8000-000000000005', 'c3000000-0000-4000-8000-000000000001', 'Slice 5B Archived Excluded', 'Archived content', 'archived', 'all_parishes', now(), now(), 'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005'),
  ('c6000000-0000-4000-8000-000000000006', 'c3000000-0000-4000-8000-000000000003', 'Slice 5B Inactive Diocese Excluded', 'Inactive Diocese content', 'published', 'all_parishes', now(), null, 'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005'),
  ('c6000000-0000-4000-8000-000000000007', 'c3000000-0000-4000-8000-000000000001', 'Slice 5B Wrong Church Target', 'Wrong church target content', 'published', 'selected_parishes', now(), null, 'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005');

insert into public.diocese_announcement_parish_targets (id, announcement_id, diocese_id, church_id)
values
  ('c9000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001'),
  ('c9000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002'),
  ('c9000000-0000-4000-8000-000000000003', 'c6000000-0000-4000-8000-000000000007', 'c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000005');

reset role;

select pg_temp.assert_false(
  has_function_privilege('anon', 'public.get_member_diocese_announcements(uuid,integer)', 'EXECUTE'),
  'anon cannot execute the member Diocese announcement RPC'
);

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.get_member_diocese_announcements(uuid,integer)', 'EXECUTE'),
  'authenticated can execute the member Diocese announcement RPC'
);

select pg_temp.assert_false(
  has_function_privilege('authenticated', 'public.is_diocese_staff(uuid,uuid)', 'EXECUTE'),
  'internal Diocese helper privileges remain unchanged'
);

set local role authenticated;

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice5b-email-only@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5b-email-only@test.invalid"}', true);

select pg_temp.assert_false(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
  ),
  'Email-matched active parish member row without matching user_id does not authorize Diocese announcement delivery'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice5b-canonical-only@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5b-canonical-only@test.invalid"}', true);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
    where title = 'Slice 5B All Parishes'
  ),
  'Active canonical church_memberships row authorizes Diocese announcement delivery'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice5b-linked-member@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5b-linked-member@test.invalid"}', true);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
    where title = 'Slice 5B All Parishes'
  ),
  'Active members row linked by user_id authorizes Diocese announcement delivery'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000009', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice5b-inactive-member@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5b-inactive-member@test.invalid"}', true);

select pg_temp.assert_false(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
  ),
  'Inactive members row without active canonical membership does not authorize Diocese announcement delivery'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice5b-parish-a-member@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5b-parish-a-member@test.invalid"}', true);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
    where title = 'Slice 5B All Parishes'
      and source = 'diocese'
      and church_id = 'c2000000-0000-4000-8000-000000000001'
  ),
  'Parish A member receives a published all-parishes Diocese A announcement'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
    where title = 'Slice 5B Parish A Selected'
  ),
  'Parish A member receives a published selected-parishes announcement targeting Parish A'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000002', 20)
  ),
  'Parish A member cannot request Parish B unless independently authorized there'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000003', 20)
  ),
  'Inactive Diocese-church relationship returns no Diocese announcements'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000004', 20)
  ),
  'Inactive Diocese returns no Diocese announcements'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
    where title in (
      'Slice 5B Draft Excluded',
      'Slice 5B Archived Excluded',
      'Slice 5B Wrong Church Target'
    )
  ),
  'Draft, archived, and wrong-church selected Diocese announcements are excluded'
);

select pg_temp.assert_true(
  position(
    'dat.diocese_id = da.diocese_id'
    in pg_get_functiondef('public.get_member_diocese_announcements(uuid,integer)'::regprocedure)
  ) > 0,
  'Selected target must match announcement Diocese defensively'
);

select pg_temp.assert_true(
  pg_get_function_result('public.get_member_diocese_announcements(uuid,integer)'::regprocedure) not like '%created_by%'
    and pg_get_function_result('public.get_member_diocese_announcements(uuid,integer)'::regprocedure) not like '%updated_by%',
  'Member delivery result does not expose management-only created_by metadata'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.email', 'slice5b-parish-b-member@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5b-parish-b-member@test.invalid"}', true);

select pg_temp.assert_false(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000002', 20)
    where title = 'Slice 5B Parish A Selected'
  ),
  'Parish B member does not receive a Parish-A-only selected announcement'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000002', 20)
    where title = 'Slice 5B Parish B Selected'
  ),
  'Parish B member receives only independently targeted Diocese B announcements'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'slice5b-multi-member@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5b-multi-member@test.invalid"}', true);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
    where title = 'Slice 5B Parish A Selected'
  )
  and exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000002', 20)
    where title = 'Slice 5B Parish B Selected'
  ),
  'Multi-church member retrieves the correct Diocese announcement set for each authorized church'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.email', 'slice5b-diocese-staff@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice5b-diocese-staff@test.invalid"}', true);

select pg_temp.assert_false(
  exists (
    select 1
    from public.get_member_diocese_announcements('c2000000-0000-4000-8000-000000000001', 20)
  ),
  'Diocese staff without legitimate Parish A member access receives no member-delivery data for Parish A'
);

select pg_temp.assert_false(
  public.is_church_admin('c1000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000001'),
  'Diocese staff remains non-church-admin unless independently granted church authority'
);

reset role;

select pg_temp.assert_true(
  (select count(*) from public.church_memberships where user_id = 'c1000000-0000-4000-8000-000000000004') = 0
    and (select count(*) from public.user_roles where user_id = 'c1000000-0000-4000-8000-000000000004') = 0,
  'Calling the member delivery RPC creates no church_memberships or user_roles for Diocese staff'
);

rollback;
