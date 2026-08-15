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
  ('10000000-0000-4000-8000-000000000001', 'admin-a@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'member-a@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'admin-b@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'member-b@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-4000-8000-000000000005', 'treasurer-a@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-4000-8000-000000000006', 'community-a@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-4000-8000-000000000007', 'super@uat.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, church_code, owner_id, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'Radio Church A', 'radio-church-a', 'KC-RAD-AAA-001', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Radio Church B', 'radio-church-b', 'KC-RAD-BBB-002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003'),
  ('20000000-0000-4000-8000-000000000003', 'Unprovisioned Church', 'radio-church-new', 'KC-RAD-NEW-003', null, null);

insert into public.user_roles (user_id, church_id, role) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'church_admin'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'member'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'church_admin'),
  ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'member'),
  ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'treasurer'),
  ('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'community_leader');

insert into public.super_admins (id) values ('10000000-0000-4000-8000-000000000007');

insert into public.church_features (church_id, feature_id, enabled)
select church_id, id, false
from (values
  ('20000000-0000-4000-8000-000000000001'::uuid),
  ('20000000-0000-4000-8000-000000000002'::uuid)
) churches(church_id)
cross join public.platform_features
where key = 'radio';

insert into public.church_role_permissions
  (church_id, role, feature_id, can_view, can_create, can_edit, can_delete, can_manage)
select church_id, role, feature_id,
  role in ('church_admin', 'member'),
  role = 'church_admin', role = 'church_admin', role = 'church_admin', role = 'church_admin'
from (values
  ('20000000-0000-4000-8000-000000000001'::uuid),
  ('20000000-0000-4000-8000-000000000002'::uuid)
) churches(church_id)
cross join (values ('church_admin'), ('pastor'), ('secretary'), ('treasurer'), ('member')) roles(role)
cross join lateral (select id as feature_id from public.platform_features where key = 'radio') feature;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  not public.has_radio_permission(auth.uid(), '20000000-0000-4000-8000-000000000001', 'view'),
  '1 radio disabled -> member denied'
);

update public.church_features set enabled = true
where church_id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
  and feature_id = (select id from public.platform_features where key = 'radio');

select pg_temp.assert_true(
  public.has_radio_permission(auth.uid(), '20000000-0000-4000-8000-000000000001', 'view'),
  '2 radio enabled + member view -> allowed'
);
select pg_temp.assert_true(
  not public.has_radio_permission(auth.uid(), '20000000-0000-4000-8000-000000000003', 'view'),
  '3 new/unprovisioned church -> denied'
);

insert into public.radio_stations (id, name, stream_url, is_active, is_approved) values
  ('30000000-0000-4000-8000-000000000001', 'Usable', 'https://radio.example/usable.mp3', true, true),
  ('30000000-0000-4000-8000-000000000002', 'Inactive', 'https://radio.example/inactive.mp3', false, true),
  ('30000000-0000-4000-8000-000000000003', 'Unapproved', 'https://radio.example/unapproved.mp3', true, false);

do $$ begin
  begin
    insert into public.radio_stations (name, stream_url, is_active, is_approved)
    values ('Unsafe', 'http://127.0.0.1/radio', true, true);
    raise exception 'FAIL: 7 invalid stream URL accepted';
  exception when check_violation then
    raise notice 'PASS: 7 invalid stream URL rejected';
  end;
end $$;

insert into public.church_radio_stations (church_id, radio_station_id, enabled, is_default, sort_order) values
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, true, 0),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', true, false, 1),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', true, false, 2);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true((select count(*) = 1 from public.radio_stations), '4 approved+active station usable');
select pg_temp.assert_true(not exists (select 1 from public.radio_stations where id = '30000000-0000-4000-8000-000000000002'), '5 inactive station hidden');
select pg_temp.assert_true(not exists (select 1 from public.radio_stations where id = '30000000-0000-4000-8000-000000000003'), '6 unapproved station hidden');
select pg_temp.assert_true((select count(*) = 3 from public.church_radio_stations), '8 Church A selections visible to A');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true((select count(*) = 0 from public.church_radio_stations), '9 Church A selections invisible to B');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
do $$ begin
  begin
    perform public.set_church_radio_selection('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, true, 0);
    raise exception 'FAIL: 10 Church B admin mutated Church A selection';
  exception when insufficient_privilege then
    raise notice 'PASS: 10 Church A admin cannot mutate B selection';
  end;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select public.set_church_radio_selection('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, true, 9);
select pg_temp.assert_true(true, '11 admin selection management allowed');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$ begin begin
  perform public.set_church_radio_selection('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, false, 1);
  raise exception 'FAIL: 12 member management allowed';
exception when insufficient_privilege then raise notice 'PASS: 12 member management denied'; end; end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
do $$ begin begin
  perform public.set_church_radio_selection('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, false, 1);
  raise exception 'FAIL: 13 treasurer management allowed';
exception when insufficient_privilege then raise notice 'PASS: 13 treasurer management denied'; end; end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000006', true);
do $$ begin begin
  perform public.set_church_radio_selection('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, false, 1);
  raise exception 'FAIL: 14 community leader management allowed';
exception when insufficient_privilege then raise notice 'PASS: 14 community leader management denied'; end; end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000007', true);
insert into public.radio_stations (id, name, stream_url, is_active, is_approved)
values ('30000000-0000-4000-8000-000000000004', 'Super Managed', 'https://radio.example/super.mp3', true, true);
select pg_temp.assert_true(true, '15 super-admin directory management allowed');

reset role;
set local role anon;
do $$ begin begin
  perform count(*) from public.church_radio_stations;
  raise exception 'FAIL: 16 anonymous protected access allowed';
exception when insufficient_privilege then raise notice 'PASS: 16 anonymous protected access denied'; end; end $$;
do $$ begin begin
  insert into public.radio_stations (name, stream_url) values ('Anon', 'https://radio.example/anon.mp3');
  raise exception 'FAIL: 17 public write allowed';
exception when insufficient_privilege then raise notice 'PASS: 17 public writes denied'; end; end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$ begin begin
  insert into public.radio_stations (name, stream_url) values ('Member Write', 'https://radio.example/member-write.mp3');
  raise exception 'FAIL: 18 authenticated non-super directory mutation allowed';
exception when insufficient_privilege then raise notice 'PASS: 18 authenticated user cannot mutate central directory'; end; end $$;

reset role;
do $$ begin begin
  insert into public.church_radio_stations (church_id, radio_station_id)
  values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
  raise exception 'FAIL: 19 duplicate church/station selection allowed';
exception when unique_violation then raise notice 'PASS: 19 duplicate church/station selection prevented'; end; end $$;

rollback;
