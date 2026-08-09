\set ON_ERROR_STOP on
begin;
select '1..1';

do $$
begin
  assert public.youtube_video_id('https://youtube.com/watch?v=abc123DEF45') = 'abc123DEF45';
  assert public.youtube_video_id('https://youtu.be/uvw123XYZ89?t=1') = 'uvw123XYZ89';
  assert public.youtube_video_id('https://youtube.com/live/qrs123TUV67') = 'qrs123TUV67';
  assert public.youtube_video_id('https://youtube.com/live/short') is null;
  assert public.youtube_video_id('https://example.com/watch?v=abc123DEF45') is null;
end;
$$;

insert into public.churches(id,name,slug) values
  ('b1000000-0000-4000-8000-000000000001','Provider Sync A','provider-sync-a'),
  ('b2000000-0000-4000-8000-000000000002','Provider Sync B','provider-sync-b'),
  ('b3000000-0000-4000-8000-000000000003','Provider Sync Disabled','provider-sync-disabled');

update public.subscriptions set plan='pro',status='active',expires_at=null
where church_id in ('b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000003');

insert into public.church_livestreams(id,church_id,title,provider,watch_url,scheduled_start) values
  ('b4000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001','Provider Stream','youtube','https://youtube.com/watch?v=abc123DEF45',now()),
  ('b5000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000002','Other Stream','youtube','https://youtu.be/uvw123XYZ89',now()),
  ('b6000000-0000-4000-8000-000000000006','b3000000-0000-4000-8000-000000000003','Disabled Stream','youtube','https://youtube.com/live/qrs123TUV67',now()),
  ('b7000000-0000-4000-8000-000000000007','b1000000-0000-4000-8000-000000000001','Manual Stream','custom','https://example.test/live',now());

update public.church_features cf set enabled=false
from public.platform_features pf
where cf.feature_id=pf.id and pf.key='livestream'
  and cf.church_id='b3000000-0000-4000-8000-000000000003';

set local role service_role;
set local request.jwt.claim.role = 'service_role';

select public.apply_livestream_provider_check(
  'b4000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001',
  'youtube','abc123DEF45','scheduled',now(),null,null,null,null,null
);

do $$ begin
  assert (select status='scheduled' and provider_status='scheduled' from public.church_livestreams where id='b4000000-0000-4000-8000-000000000004');
end $$;

select public.apply_livestream_provider_check(
  'b4000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001',
  'youtube','abc123DEF45','live',now(),'2026-08-09T08:01:00Z',null,'https://img.youtube.com/vi/abc123DEF45/maxresdefault.jpg',null,null
);

do $$ begin
  assert (select status='live' and status_source='provider' and actual_started_at='2026-08-09T08:01:00Z'::timestamptz from public.church_livestreams where id='b4000000-0000-4000-8000-000000000004');
end $$;

select public.apply_livestream_provider_check(
  'b4000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001',
  'youtube','abc123DEF45','scheduled',now(),null,null,null,null,null
);
select public.apply_livestream_provider_check(
  'b4000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001',
  'youtube','abc123DEF45','unknown',now(),null,null,null,null,'provider_temporary'
);

do $$ begin
  assert (select status='live' and provider_status='unknown' and provider_failure_count=1 from public.church_livestreams where id='b4000000-0000-4000-8000-000000000004');
end $$;

select public.apply_livestream_provider_check(
  'b4000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001',
  'youtube','abc123DEF45','ended',now(),null,'2026-08-09T09:00:00Z',null,null,null
);

do $$
begin
  assert (select status='ended' and actual_ended_at='2026-08-09T09:00:00Z'::timestamptz from public.church_livestreams where id='b4000000-0000-4000-8000-000000000004');
  assert exists (select 1 from public.audit_logs where action='livestream.auto_started' and entity_id='b4000000-0000-4000-8000-000000000004');
  assert exists (select 1 from public.audit_logs where action='livestream.auto_ended' and entity_id='b4000000-0000-4000-8000-000000000004');
  assert (select provider_external_id is null and status='scheduled' from public.church_livestreams where id='b7000000-0000-4000-8000-000000000007');
end;
$$;

do $$
begin
  begin
    perform public.apply_livestream_provider_check(
      'b5000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000001',
      'youtube','uvw123XYZ89','live',now(),null,null,null,null,null
    );
    raise exception 'Cross-church provider update unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.apply_livestream_provider_check(
      'b6000000-0000-4000-8000-000000000006','b3000000-0000-4000-8000-000000000003',
      'youtube','qrs123TUV67','live',now(),null,null,null,null,null
    );
    raise exception 'Disabled church provider update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select 'ok 1 - provider status sync is forward-only, tenant-scoped, and conservative';
rollback;
