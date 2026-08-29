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

create or replace function pg_temp.assert_status_rejected(_status text)
returns void language plpgsql as $$
begin
  begin
    insert into public.churches (id, name, slug, status)
    values (gen_random_uuid(), 'Invalid Status Church', 'invalid-status-' || lower(_status), _status);
  exception
    when check_violation then
      raise notice 'PASS: invalid church status % rejected', _status;
      return;
  end;

  raise exception 'FAIL: invalid church status % was accepted', _status;
end;
$$;

insert into public.churches (id, name, slug, status) values
  ('62000000-0000-4000-8000-000000000001', 'Lifecycle Pending Parish', 'lifecycle-pending', 'pending'),
  ('62000000-0000-4000-8000-000000000002', 'Lifecycle Active Parish', 'lifecycle-active', 'active'),
  ('62000000-0000-4000-8000-000000000003', 'Lifecycle Inactive Parish', 'lifecycle-inactive', 'inactive'),
  ('62000000-0000-4000-8000-000000000004', 'Lifecycle Suspended Parish', 'lifecycle-suspended', 'suspended');

insert into public.churches (id, name, slug)
values ('62000000-0000-4000-8000-000000000005', 'Lifecycle Default Parish', 'lifecycle-default');

select pg_temp.assert_true(
  (select array_agg(status order by status) = array['active','inactive','pending','suspended']
   from public.churches
   where id between '62000000-0000-4000-8000-000000000001'::uuid
     and '62000000-0000-4000-8000-000000000004'::uuid),
  'allowed church lifecycle statuses are accepted'
);

select pg_temp.assert_status_rejected('archived');

select pg_temp.assert_true(
  (select status = 'active'
   from public.churches
   where id = '62000000-0000-4000-8000-000000000005'),
  'churches inserted without an explicit status default to active'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.get_public_join_church('lifecycle-active')),
  'active church is discoverable by public join lookup'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.get_public_join_church('lifecycle-pending')),
  'pending church is hidden from public join lookup'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.get_public_join_church('lifecycle-inactive')),
  'inactive church is hidden from public join lookup'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.get_public_join_church('lifecycle-suspended')),
  'suspended church is hidden from public join lookup'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.get_public_registration_church(null, '62000000-0000-4000-8000-000000000002')),
  'active church is discoverable by public registration lookup'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.get_public_registration_church(null, '62000000-0000-4000-8000-000000000001')),
  'pending church is hidden from public registration lookup'
);

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('61000000-0000-4000-8000-000000000001', 'lifecycle-a@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('61000000-0000-4000-8000-000000000002', 'lifecycle-b@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.members (id, church_id, user_id, full_name, email, status) values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000001', 'Lifecycle Member A', 'lifecycle-a@test.invalid', 'active'),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000002', 'Lifecycle Member B', 'lifecycle-b@test.invalid', 'active');

set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  (select count(*) = 1
   from public.churches
   where id = '62000000-0000-4000-8000-000000000002'),
  'tenant user can still read their own church'
);

select pg_temp.assert_true(
  (select count(*) = 0
   from public.churches
   where id = '62000000-0000-4000-8000-000000000003'),
  'tenant user cannot read a foreign church'
);

rollback;
