\set ON_ERROR_STOP on
begin;

select '1..1';

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('d1000000-0000-4000-8000-000000000001','authenticated','authenticated','media-publisher@test.invalid','',now(),'{}','{}',now(),now()),
  ('d2000000-0000-4000-8000-000000000002','authenticated','authenticated','media-ordinary@test.invalid','',now(),'{}','{}',now(),now());

insert into public.churches (id,name,slug) values
  ('d3000000-0000-4000-8000-000000000003','Media Conversion Church','media-conversion-church'),
  ('d4000000-0000-4000-8000-000000000004','Other Media Church','other-media-church');
update public.subscriptions set plan='pro',status='active',expires_at=null
where church_id in ('d3000000-0000-4000-8000-000000000003','d4000000-0000-4000-8000-000000000004');

insert into public.user_roles (user_id,church_id,role) values
  ('d1000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000003','church_admin');

update public.church_features cf set enabled=true,locked=false
from public.platform_features pf
where cf.church_id='d3000000-0000-4000-8000-000000000003'
  and cf.feature_id=pf.id and pf.key in ('livestream','sermons');

update public.church_role_permissions crp set
  can_view=true, can_create=true, can_edit=true, can_delete=true,
  can_publish=true, can_manage=true
from public.platform_features pf
where crp.church_id='d3000000-0000-4000-8000-000000000003'
  and crp.role='church_admin' and crp.feature_id=pf.id
  and pf.key in ('livestream','sermons');

alter table public.church_livestreams disable trigger enforce_church_livestream_lifecycle_trigger;
insert into public.church_livestreams (
  id,church_id,status,title,provider,watch_url,recording_url,
  scheduled_start,actual_started_at,actual_ended_at,created_by
) values
  ('d5000000-0000-4000-8000-000000000005','d3000000-0000-4000-8000-000000000003','ended','Sunday Teaching','youtube','https://youtube.com/watch?v=abc123DEF45','https://example.test/recording','2026-08-09T07:00:00Z','2026-08-09T07:02:00Z','2026-08-09T08:00:00Z','d1000000-0000-4000-8000-000000000001'),
  ('d6000000-0000-4000-8000-000000000006','d4000000-0000-4000-8000-000000000004','ended','Other Church Teaching','youtube','https://youtu.be/uvw123XYZ89','https://example.test/other-recording','2026-08-09T09:00:00Z','2026-08-09T09:02:00Z','2026-08-09T10:00:00Z','d2000000-0000-4000-8000-000000000002'),
  ('d7000000-0000-4000-8000-000000000007','d3000000-0000-4000-8000-000000000003','ended','No Recording','youtube','https://youtube.com/live/qrs123TUV67',null,'2026-08-10T07:00:00Z','2026-08-10T07:02:00Z','2026-08-10T08:00:00Z','d1000000-0000-4000-8000-000000000001');
alter table public.church_livestreams enable trigger enforce_church_livestream_lifecycle_trigger;

set local role authenticated;
set local request.jwt.claim.sub = 'd2000000-0000-4000-8000-000000000002';
do $$ begin
  begin
    perform public.publish_livestream_as_sermon('d5000000-0000-4000-8000-000000000005','Unauthorized',null,null,null);
    raise exception 'unauthorized conversion unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claim.sub = 'd1000000-0000-4000-8000-000000000001';
do $$ begin
  begin
    perform public.publish_livestream_as_sermon('d6000000-0000-4000-8000-000000000006','Cross church',null,null,null);
    raise exception 'cross-church conversion unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.publish_livestream_as_sermon('d7000000-0000-4000-8000-000000000007','Watch URL only',null,null,null);
    raise exception 'watch URL conversion unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
end $$;

select public.publish_livestream_as_sermon(
  'd5000000-0000-4000-8000-000000000005','Reviewed Sunday Teaching','Fr Example','2026-08-09','Reviewed notes'
);

do $$ begin
  begin
    perform public.publish_livestream_as_sermon('d5000000-0000-4000-8000-000000000005','Duplicate',null,null,null);
    raise exception 'duplicate conversion unexpectedly succeeded';
  exception when unique_violation then null;
  end;
end $$;

reset role;
do $$
begin
  assert exists (
    select 1 from public.sermons
    where church_id='d3000000-0000-4000-8000-000000000003'
      and source_livestream_id='d5000000-0000-4000-8000-000000000005'
      and title='Reviewed Sunday Teaching'
      and video_url='https://example.test/recording'
      and video_url <> 'https://example.test/live'
  ), 'Converted sermon must use reviewed title and recording URL';
  assert (select count(*)=1 from public.sermons where source_livestream_id='d5000000-0000-4000-8000-000000000005'),
    'Source livestream must map to exactly one sermon';
  assert (select status='ended' from public.church_livestreams where id='d5000000-0000-4000-8000-000000000005'),
    'Conversion must not alter historical livestream status';
  assert not exists (select 1 from public.sermons where source_livestream_id in ('d6000000-0000-4000-8000-000000000006','d7000000-0000-4000-8000-000000000007')),
    'Rejected conversions must not create sermons';
end;
$$;

select 'ok 1 - livestream publish-as-sermon authorization and provenance passed';
rollback;
