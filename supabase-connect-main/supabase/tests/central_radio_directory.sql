\set ON_ERROR_STOP on
begin;

select '1..1';

-- Reproduce duplicate consolidation independently of production tables. The
-- featured row has the higher UUID, so retaining min(id) would violate the
-- one-featured-per-church index during the aggregate update.
create temporary table duplicate_consolidation_fixture (
  id uuid primary key,
  church_id uuid not null,
  radio_station_id uuid not null,
  enabled boolean not null,
  is_featured boolean not null,
  sort_order integer not null
) on commit drop;
create unique index duplicate_consolidation_one_featured_idx
  on duplicate_consolidation_fixture(church_id) where is_featured;
insert into duplicate_consolidation_fixture values
  ('00000000-0000-4000-8000-0000000000ff','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',true,true,0),
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',false,false,9),
  ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',false,false,7),
  ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',true,false,3),
  ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',true,false,2);
with grouped as (
  select church_id, radio_station_id,
    (array_agg(id order by is_featured desc, id::text))[1] as keep_id,
    bool_or(enabled) as enabled, bool_or(is_featured) as is_featured,
    min(sort_order) as sort_order
  from duplicate_consolidation_fixture
  group by church_id, radio_station_id
)
update duplicate_consolidation_fixture selection
set enabled=grouped.enabled, is_featured=grouped.is_featured, sort_order=grouped.sort_order
from grouped where selection.id=grouped.keep_id;
with grouped as (
  select church_id, radio_station_id,
    (array_agg(id order by is_featured desc, id::text))[1] as keep_id
  from duplicate_consolidation_fixture
  group by church_id, radio_station_id
)
delete from duplicate_consolidation_fixture selection using grouped
where selection.church_id=grouped.church_id
  and selection.radio_station_id=grouped.radio_station_id
  and selection.id<>grouped.keep_id;
do $$ begin
  assert (select count(*)=3 from duplicate_consolidation_fixture), 'Duplicate consolidation did not retain one row per church/station';
  assert exists (select 1 from duplicate_consolidation_fixture where id='00000000-0000-4000-8000-0000000000ff' and enabled and is_featured and sort_order=0), 'Featured higher-UUID keeper lost aggregate state';
  assert exists (select 1 from duplicate_consolidation_fixture where church_id='10000000-0000-4000-8000-000000000001' and radio_station_id='20000000-0000-4000-8000-000000000002' and enabled and not is_featured and sort_order=3), 'Non-featured aggregate state changed';
  assert exists (select 1 from duplicate_consolidation_fixture where church_id='10000000-0000-4000-8000-000000000002' and radio_station_id='20000000-0000-4000-8000-000000000001'), 'Cross-church association was removed';
  assert (select count(*)=1 from duplicate_consolidation_fixture where church_id='10000000-0000-4000-8000-000000000001' and is_featured), 'Fixture violated single-featured invariant';
end $$;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('b1100000-0000-4000-8000-000000000001','authenticated','authenticated','radio-super@test.invalid','',now(),'{}','{}',now(),now()),
  ('b1200000-0000-4000-8000-000000000002','authenticated','authenticated','radio-admin@test.invalid','',now(),'{}','{}',now(),now()),
  ('b1300000-0000-4000-8000-000000000003','authenticated','authenticated','radio-member@test.invalid','',now(),'{}','{}',now(),now());
insert into public.super_admins (id) values ('b1100000-0000-4000-8000-000000000001');
insert into public.churches (id,name,slug) values
  ('b1400000-0000-4000-8000-000000000004','Central Radio A','central-radio-a'),
  ('b1500000-0000-4000-8000-000000000005','Central Radio B','central-radio-b');
insert into public.user_roles (id,user_id,church_id,role) values
  ('b1600000-0000-4000-8000-000000000006','b1200000-0000-4000-8000-000000000002','b1400000-0000-4000-8000-000000000004','church_admin'),
  ('b1700000-0000-4000-8000-000000000007','b1300000-0000-4000-8000-000000000003','b1400000-0000-4000-8000-000000000004','member');
update public.subscriptions set plan='pro',status='active',expires_at=now()+interval '7 days'
where church_id in ('b1400000-0000-4000-8000-000000000004','b1500000-0000-4000-8000-000000000005');
update public.church_features cf set enabled=true
from public.platform_features pf where cf.feature_id=pf.id and pf.key='radio'
and cf.church_id in ('b1400000-0000-4000-8000-000000000004','b1500000-0000-4000-8000-000000000005');

set local role authenticated;
set local request.jwt.claim.sub='b1100000-0000-4000-8000-000000000001';
insert into public.radio_stations (id,name,stream_url,metadata_url,is_active,is_approved) values
  ('b1800000-0000-4000-8000-000000000008','Approved Radio','https://radio.example.com/live','https://radio.example.com/metadata',true,true),
  ('b1900000-0000-4000-8000-000000000009','Unapproved Radio','https://radio.example.com/review',null,true,false),
  ('b2000000-0000-4000-8000-000000000010','Inactive Radio','https://radio.example.com/offline',null,false,true);
do $$ begin
  assert exists (
    select 1 from public.get_platform_radio_stations()
    where id='b1800000-0000-4000-8000-000000000008'
      and metadata_url='https://radio.example.com/metadata'
  ), 'Super Admin metadata URL was not preserved';
end $$;

reset role;
do $$ begin
  assert not has_table_privilege('authenticated','public.radio_stations','SELECT'), 'Authenticated retained broad table SELECT';
  assert not has_column_privilege('authenticated','public.radio_stations','metadata_url','SELECT'), 'Authenticated retained metadata_url SELECT';
  assert has_column_privilege('authenticated','public.radio_stations','stream_url','SELECT'), 'Authenticated lost stream_url SELECT';
  assert has_column_privilege('authenticated','public.radio_stations','name','SELECT'), 'Authenticated lost catalogue name SELECT';
  assert has_column_privilege('authenticated','public.radio_stations','health_status','SELECT'), 'Authenticated lost health status SELECT';
end $$;
set local role authenticated;
set local request.jwt.claim.sub='b1200000-0000-4000-8000-000000000002';
do $$ begin
  begin
    perform metadata_url from public.radio_stations limit 1;
    raise exception 'Church Admin read platform metadata URL';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.radio_stations(name,stream_url,is_approved) values ('Forbidden','https://radio.example.com/forbidden',true);
    raise exception 'Church Admin created a platform station';
  exception when insufficient_privilege then null; end;
  update public.radio_stations set stream_url='https://radio.example.com/changed'
  where id='b1800000-0000-4000-8000-000000000008';
  assert exists (
    select 1 from public.radio_stations
    where id='b1800000-0000-4000-8000-000000000008'
      and stream_url='https://radio.example.com/live'
  ), 'Church Admin edited platform stream URL';
  assert exists (
    select 1 from public.radio_stations
    where id='b1800000-0000-4000-8000-000000000008'
      and name='Approved Radio' and stream_url='https://radio.example.com/live'
  ), 'Church Admin could not read approved catalogue fields';
end $$;
select public.set_church_radio_selection('b1400000-0000-4000-8000-000000000004','b1800000-0000-4000-8000-000000000008',true,true,0);
select public.set_church_radio_selection('b1400000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000010',true,false,1);
select public.set_church_radio_selection('b1400000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000010',true,true,1);
do $$ begin
  assert exists (select 1 from public.church_radio_stations where church_id='b1400000-0000-4000-8000-000000000004' and radio_station_id='b2000000-0000-4000-8000-000000000010' and is_featured), 'Featured replacement did not select the new station';
  assert not exists (select 1 from public.church_radio_stations where church_id='b1400000-0000-4000-8000-000000000004' and radio_station_id='b1800000-0000-4000-8000-000000000008' and is_featured), 'Featured replacement did not clear the previous station';
end $$;
select public.set_church_radio_selection('b1400000-0000-4000-8000-000000000004','b1800000-0000-4000-8000-000000000008',true,true,0);
do $$ begin
  begin
    perform public.set_church_radio_selection('b1500000-0000-4000-8000-000000000005','b1800000-0000-4000-8000-000000000008',true,false,0);
    raise exception 'Church Admin changed another church';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_church_radio_selection('b1400000-0000-4000-8000-000000000004','b1900000-0000-4000-8000-000000000009',true,false,0);
    raise exception 'Church Admin selected an unapproved station';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claim.sub='b1300000-0000-4000-8000-000000000003';
do $$ begin
  begin
    perform metadata_url from public.radio_stations limit 1;
    raise exception 'Member read platform metadata URL';
  exception when insufficient_privilege then null; end;
  delete from public.radio_stations where id='b1800000-0000-4000-8000-000000000008';
  assert exists (
    select 1 from public.radio_stations
    where id='b1800000-0000-4000-8000-000000000008'
  ), 'Member mutated the platform catalogue';
  assert (select count(*)=2 from public.church_radio_stations where church_id='b1400000-0000-4000-8000-000000000004'), 'Member selection scope changed';
  assert (select count(*)=1 from public.radio_stations), 'Member must see only selected, approved, active stations';
  assert exists (
    select 1 from public.church_radio_stations selection
    join public.radio_stations station on station.id=selection.radio_station_id
    where selection.church_id='b1400000-0000-4000-8000-000000000004'
      and selection.enabled and selection.is_featured and station.name='Approved Radio'
  ), 'Member did not resolve the featured approved station';
end $$;

reset role;
do $$ begin
  assert (select count(*)=1 from public.church_radio_stations where church_id='b1400000-0000-4000-8000-000000000004' and is_featured), 'Only one station may be featured per church';
  assert exists (select 1 from pg_constraint where conrelid='public.church_radio_stations'::regclass and confrelid='public.radio_stations'::regclass), 'Selection FK missing';
  assert exists (select 1 from pg_indexes where indexname='church_radio_stations_church_station_idx'), 'Unique church/station association missing';
end $$;

select 'ok 1 - central Radio directory authorization and isolation passed';
rollback;
