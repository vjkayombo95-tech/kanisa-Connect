\set ON_ERROR_STOP on
begin;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a1000000-0000-4000-8000-000000000001','authenticated','authenticated','member-a@test.invalid','',now(),'{}','{}',now(),now()),
('a2000000-0000-4000-8000-000000000002','authenticated','authenticated','admin-a@test.invalid','',now(),'{}','{}',now(),now()),
('a3000000-0000-4000-8000-000000000003','authenticated','authenticated','pastor-a@test.invalid','',now(),'{}','{}',now(),now()),
('a4000000-0000-4000-8000-000000000004','authenticated','authenticated','secretary-a@test.invalid','',now(),'{}','{}',now(),now()),
('a5000000-0000-4000-8000-000000000005','authenticated','authenticated','treasurer-a@test.invalid','',now(),'{}','{}',now(),now()),
('b1000000-0000-4000-8000-000000000001','authenticated','authenticated','member-b@test.invalid','',now(),'{}','{}',now(),now()),
('b2000000-0000-4000-8000-000000000002','authenticated','authenticated','admin-b@test.invalid','',now(),'{}','{}',now(),now());
insert into public.churches (id,name,slug) values
('a0000000-0000-4000-8000-000000000000','Church A','production-live-test-a'),
('b0000000-0000-4000-8000-000000000000','Church B','production-live-test-b');
insert into public.user_roles(user_id,church_id,role) values
('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000000','member'),
('a2000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000000','church_admin'),
('a3000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000000','pastor'),
('a4000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000000','secretary'),
('a5000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000000','treasurer'),
('b1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000000','member'),
('b2000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000000','church_admin');
insert into public.church_features(church_id,feature_id,enabled)
select c.id,pf.id,false from public.churches c cross join public.platform_features pf
where c.id in ('a0000000-0000-4000-8000-000000000000','b0000000-0000-4000-8000-000000000000') and pf.key='livestream';
insert into public.church_role_permissions(church_id,role,feature_id,can_view,can_create,can_edit,can_delete,can_manage)
select c.id,r.role,pf.id,
  r.role in ('church_admin','pastor'),r.role in ('church_admin','pastor'),r.role in ('church_admin','pastor'),
  r.role in ('church_admin','pastor'),r.role in ('church_admin','pastor')
from public.churches c cross join (values ('church_admin'),('pastor'),('secretary'),('treasurer'),('member')) r(role)
cross join public.platform_features pf
where c.id in ('a0000000-0000-4000-8000-000000000000','b0000000-0000-4000-8000-000000000000') and pf.key='livestream';

do $$ begin
  assert (select relrowsecurity from pg_class where oid='public.church_livestreams'::regclass);
  assert not has_table_privilege('anon','public.church_livestreams','select,insert,update,delete');
  assert not has_function_privilege('anon','public.transition_production_livestream(uuid,text)','execute');
  assert not has_function_privilege('anon','public.youtube_livestream_video_id(text)','execute');
  assert not has_function_privilege('authenticated','public.youtube_livestream_video_id(text)','execute');
  assert not has_function_privilege('authenticated','public.enforce_production_livestream()','execute');
  assert not exists (select 1 from information_schema.role_routine_grants where routine_schema='public'
    and routine_name in ('youtube_livestream_video_id','enforce_production_livestream','transition_production_livestream')
    and grantee='PUBLIC' and privilege_type='EXECUTE');
end $$;

-- Feature disabled overrides a true view permission.
update public.church_role_permissions crp set can_view=true from public.platform_features pf
where crp.feature_id=pf.id and pf.key='livestream' and crp.role='member';
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
do $$ begin assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','view'); end $$;
reset role;

-- Enabled feature still requires explicit view.
update public.church_features cf set enabled=true from public.platform_features pf where cf.feature_id=pf.id and pf.key='livestream';
update public.church_role_permissions crp set can_view=false from public.platform_features pf where crp.feature_id=pf.id and pf.key='livestream' and crp.role='member';
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
do $$ begin assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','view'); end $$;
reset role;

-- Explicit view permits only the member's own church and never management.
update public.church_role_permissions crp set can_view=true from public.platform_features pf where crp.feature_id=pf.id and pf.key='livestream' and crp.role='member';
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
do $$ begin
  assert public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','view');
  assert not public.has_livestream_permission(auth.uid(),'b0000000-0000-4000-8000-000000000000','view');
  assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','create');
  assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','edit');
  assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','delete');
  assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','manage');
end $$;
reset role;

-- Authorized INSERT passes through the private helper via the hardened trigger.
set local role authenticated;
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000002';
insert into public.church_livestreams(id,church_id,title,watch_url,provider_external_id) values
('aa000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000000','Member visibility','https://youtu.be/M7lc1UVf-VE','M7lc1UVf-VE');
reset role;

-- Runtime RLS: member reads own row, sees no foreign rows, and cannot mutate.
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
do $$ begin
  assert (select count(*)=1 from public.church_livestreams where id='aa000000-0000-4000-8000-000000000010');
  assert not exists(select 1 from public.church_livestreams where church_id='b0000000-0000-4000-8000-000000000000');
  begin insert into public.church_livestreams(church_id,title,watch_url,provider_external_id) values ('a0000000-0000-4000-8000-000000000000','Denied','https://youtu.be/dQw4w9WgXcQ','dQw4w9WgXcQ'); raise exception 'member insert allowed'; exception when insufficient_privilege then null; end;
  update public.church_livestreams set title='Denied' where id='aa000000-0000-4000-8000-000000000010'; assert not found;
  delete from public.church_livestreams where id='aa000000-0000-4000-8000-000000000010'; assert not found;
  begin perform public.transition_production_livestream('aa000000-0000-4000-8000-000000000010','live'); raise exception 'member transition allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Admin create/edit/delete plus legal and illegal lifecycle transitions.
set local role authenticated;
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000002';
insert into public.church_livestreams(id,church_id,title,watch_url,provider_external_id) values
('aa000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000000','A1','https://youtu.be/M7lc1UVf-VE','M7lc1UVf-VE');
update public.church_livestreams set title='A1 edited' where id='aa000000-0000-4000-8000-000000000001';
insert into public.church_livestreams(id,church_id,title,watch_url,provider_external_id) values
('aa000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000000','Delete me','https://youtu.be/ysz5S6PUM-U','ysz5S6PUM-U');
delete from public.church_livestreams where id='aa000000-0000-4000-8000-000000000003';
select public.transition_production_livestream('aa000000-0000-4000-8000-000000000001','live');
do $$ begin
  assert (select title='A1 edited' and actual_started_at is not null from public.church_livestreams where id='aa000000-0000-4000-8000-000000000001');
  begin
    insert into public.church_livestreams(id,church_id,title,watch_url,provider_external_id) values ('aa000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000000','A2','https://youtu.be/dQw4w9WgXcQ','dQw4w9WgXcQ');
    perform public.transition_production_livestream('aa000000-0000-4000-8000-000000000002','live');
    raise exception 'second live stream allowed'; exception when unique_violation then null;
  end;
  begin update public.church_livestreams set status='scheduled' where id='aa000000-0000-4000-8000-000000000001'; raise exception 'live to scheduled allowed'; exception when sqlstate '22023' then null; end;
end $$;
select public.transition_production_livestream('aa000000-0000-4000-8000-000000000001','ended');
do $$ begin
  assert (select actual_ended_at >= actual_started_at from public.church_livestreams where id='aa000000-0000-4000-8000-000000000001');
  begin perform public.transition_production_livestream('aa000000-0000-4000-8000-000000000001','live'); raise exception 'ended to live allowed'; exception when sqlstate '22023' then null; end;
  begin insert into public.church_livestreams(church_id,title,watch_url,provider_external_id) values ('a0000000-0000-4000-8000-000000000000','Unsupported','https://example.com/M7lc1UVf-VE','M7lc1UVf-VE'); raise exception 'unsupported host allowed'; exception when sqlstate '22023' then null; end;
  begin insert into public.church_livestreams(church_id,title,watch_url,provider_external_id) values ('a0000000-0000-4000-8000-000000000000','Malformed','not-a-url','M7lc1UVf-VE'); raise exception 'malformed URL allowed'; exception when sqlstate '22023' or check_violation then null; end;
  begin insert into public.church_livestreams(church_id,title,watch_url,provider_external_id) values ('a0000000-0000-4000-8000-000000000000','Missing','https://youtube.com/watch','M7lc1UVf-VE'); raise exception 'missing ID allowed'; exception when sqlstate '22023' then null; end;
  begin insert into public.church_livestreams(church_id,title,watch_url,provider_external_id) values ('a0000000-0000-4000-8000-000000000000','Bad ID','https://youtu.be/short','short'); raise exception 'invalid ID allowed'; exception when sqlstate '22023' or check_violation then null; end;
  begin insert into public.church_livestreams(church_id,title,watch_url,provider_external_id) values ('a0000000-0000-4000-8000-000000000000','Blank','','M7lc1UVf-VE'); raise exception 'blank URL allowed'; exception when sqlstate '22023' or check_violation then null; end;
end $$;
reset role;

-- Pastor defaults allow own-church management only.
set local role authenticated;
set local request.jwt.claim.sub='a3000000-0000-4000-8000-000000000003';
insert into public.church_livestreams(id,church_id,title,watch_url,provider_external_id) values
('aa000000-0000-4000-8000-000000000030','a0000000-0000-4000-8000-000000000000','Pastor','https://youtu.be/ysz5S6PUM-U','ysz5S6PUM-U');
update public.church_livestreams set title='Pastor edited' where id='aa000000-0000-4000-8000-000000000030';
do $$ begin assert not public.has_livestream_permission(auth.uid(),'b0000000-0000-4000-8000-000000000000','manage'); end $$;
delete from public.church_livestreams where id='aa000000-0000-4000-8000-000000000030';
reset role;

-- Role membership alone never implies access for default-deny roles.
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000004';
do $$ begin assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','view'); assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','manage'); end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000005';
do $$ begin assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','view'); assert not public.has_livestream_permission(auth.uid(),'a0000000-0000-4000-8000-000000000000','manage'); end $$;
reset role;

-- Church B may run independently; Church A admin cannot read or transition it.
set local role authenticated;
set local request.jwt.claim.sub='b2000000-0000-4000-8000-000000000002';
insert into public.church_livestreams(id,church_id,title,watch_url,provider_external_id) values
('bb000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000000','B1','https://youtu.be/dQw4w9WgXcQ','dQw4w9WgXcQ');
select public.transition_production_livestream('bb000000-0000-4000-8000-000000000001','live');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000002';
do $$ begin
  assert not exists(select 1 from public.church_livestreams where church_id='b0000000-0000-4000-8000-000000000000');
  begin perform public.transition_production_livestream('bb000000-0000-4000-8000-000000000001','ended'); raise exception 'cross-tenant transition allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'ok - production livestream runtime security assertions passed';
rollback;
