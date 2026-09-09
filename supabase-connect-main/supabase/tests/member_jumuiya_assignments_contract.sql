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

create or replace function pg_temp.assert_raises_auth(_sql text, _label text)
returns void language plpgsql as $$
begin
  begin
    execute _sql;
    raise exception 'FAIL: %', _label;
  exception
    when insufficient_privilege then
      raise notice 'PASS: %', _label;
  end;
end;
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('51000000-0000-4000-8000-000000000001', 'jumuiya-a@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('51000000-0000-4000-8000-000000000002', 'jumuiya-b@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('51000000-0000-4000-8000-000000000003', 'jumuiya-zero@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('51000000-0000-4000-8000-000000000004', 'jumuiya-role-only@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, church_code, owner_id, created_by) values
  ('52000000-0000-4000-8000-000000000001', 'Jumuiya Contract Church A', 'jumuiya-contract-a', 'KC-JUM-TST-001', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001'),
  ('52000000-0000-4000-8000-000000000002', 'Jumuiya Contract Church B', 'jumuiya-contract-b', 'KC-JUM-TST-002', '51000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002');

insert into public.members (id, church_id, user_id, full_name, status) values
  ('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Jumuiya Member A', 'active'),
  ('53000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'Jumuiya Member B', 'active'),
  ('53000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000003', 'Jumuiya Member Zero', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'member'),
  ('51000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', 'member'),
  ('51000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000001', 'member'),
  ('51000000-0000-4000-8000-000000000004', '52000000-0000-4000-8000-000000000001', 'member');

insert into public.communities (id, church_id, name, description, created_at) values
  ('54000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'Jumuiya A One', 'Real description one', now()),
  ('54000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000001', 'Jumuiya A Two', null, now()),
  ('54000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000001', 'Jumuiya A Three', 'Real description three', now()),
  ('54000000-0000-4000-8000-000000000004', '52000000-0000-4000-8000-000000000002', 'Jumuiya B One', 'Foreign description', now());

insert into public.member_communities (id, member_id, community_id, created_at) values
  ('55000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000001', '2026-09-01 08:00:00'),
  ('55000000-0000-4000-8000-000000000002', '53000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000002', '2026-09-02 08:00:00'),
  ('55000000-0000-4000-8000-000000000003', '53000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000003', '2026-09-03 08:00:00'),
  ('55000000-0000-4000-8000-000000000004', '53000000-0000-4000-8000-000000000002', '54000000-0000-4000-8000-000000000004', '2026-09-04 08:00:00'),
  ('55000000-0000-4000-8000-000000000005', '53000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000004', '2026-09-05 08:00:00'),
  ('55000000-0000-4000-8000-000000000006', '53000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000001', '2026-09-06 08:00:00');

reset role;
select pg_temp.assert_raises_auth(
  $$select count(*) from public.get_my_jumuiya_assignments()$$,
  'unauthenticated caller is denied'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);

select pg_temp.assert_true(
  (select count(*) = 3 from public.get_my_jumuiya_assignments()),
  'member sees all own valid assignments without limit-one behavior'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.get_my_jumuiya_assignments()
    where community_name = 'Jumuiya A One'
  ),
  'duplicate assignment rows do not duplicate a Jumuiya in the member result'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.get_my_jumuiya_assignments()
    where community_name = 'Jumuiya B One'
  ),
  'malformed cross-church relationship is hidden'
);

select pg_temp.assert_true(
  (select array_agg(community_name order by community_name) = array['Jumuiya A One','Jumuiya A Three','Jumuiya A Two']
   from public.get_my_jumuiya_assignments()),
  'presentation ordering is deterministic without primary semantics'
);

select pg_temp.assert_true(
  (
    select pg_get_function_result(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_jumuiya_assignments'
      and pg_get_function_arguments(p.oid) = ''
  ) =
  'TABLE(community_name text, description text)',
  'rpc exposes only approved minimal member-visible fields'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.get_my_jumuiya_assignments()),
  'member sees own church assignment only'
);
select pg_temp.assert_true(
  not exists (
    select 1
    from public.get_my_jumuiya_assignments()
    where community_name in ('Jumuiya A One', 'Jumuiya A Two', 'Jumuiya A Three')
  ),
  'member cannot see another church Jumuiya assignments'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.get_my_jumuiya_assignments()),
  'member with zero assignments receives safe empty result'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.get_my_jumuiya_assignments()),
  'authenticated caller with no linked member receives safe empty result'
);



select pg_temp.assert_true(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_jumuiya_assignments'
      and p.prosecdef
      and p.provolatile = 's'
      and pg_get_function_arguments(p.oid) = ''
  ),
  'rpc is stable security-definer and accepts no caller-supplied identifiers'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_jumuiya_assignments'
      and pg_get_function_arguments(p.oid) = ''
      and p.proconfig @> array['search_path=pg_catalog, public']
  ),
  'rpc has fixed search_path pg_catalog, public'
);

reset role;
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.get_my_jumuiya_assignments()', 'execute'),
  'anon execute is revoked'
);

select pg_temp.assert_true(
  not has_function_privilege('service_role', 'public.get_my_jumuiya_assignments()', 'execute'),
  'service_role execute is not granted'
);

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.get_my_jumuiya_assignments()', 'execute'),
  'authenticated execute is granted'
);

rollback;
