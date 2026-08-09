\set ON_ERROR_STOP on
begin;

select '1..1';

create or replace function pg_temp.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;

do $$
declare v_definition text;
begin
  assert (select count(*)=1 from supabase_migrations.schema_migrations where version='20260722180000'),
    'mutation alignment migration must be recorded exactly once';
  assert (select count(*)=1 from supabase_migrations.schema_migrations where version='20260722190000'),
    'Event ownership-scope migration must be recorded exactly once';
  assert (select count(*)=1 from supabase_migrations.schema_migrations where version='20260722191000'),
    'branding storage policy repair must be recorded exactly once';
  assert exists (
    select 1 from pg_policies where schemaname='public' and tablename='churches'
      and policyname='church settings manage update' and permissive='RESTRICTIVE'
      and coalesce(qual,'') ilike '%feature_permissions_admin%manage%'
  ), 'Church settings restrictive manage policy missing';
  assert exists (
    select 1 from pg_trigger where tgrelid='public.churches'::regclass
      and tgname='enforce_church_settings_manage_permission' and not tgisinternal
  ), 'Church settings enforcement trigger missing';
  assert exists (
    select 1 from pg_policies where schemaname='public' and tablename='message_templates'
      and policyname='message_templates_manage_by_permission'
      and coalesce(qual,'') ilike '%feature_permissions_admin%manage%'
  ), 'message_templates permission policy missing';
  assert exists (
    select 1 from pg_trigger where tgrelid='public.message_templates'::regclass
      and tgname='enforce_church_settings_manage_permission' and not tgisinternal
  ), 'message_templates enforcement trigger missing';
  assert exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and policyname='church settings guard asset insert' and permissive='RESTRICTIVE'
      and coalesce(with_check,'') ilike '%logos%'
      and coalesce(with_check,'') ilike '%banners%'
      and coalesce(with_check,'') ilike '%feature_permissions_admin%manage%'
  ), 'branding storage restrictive guard missing';
  assert exists (
    select 1 from pg_policies where schemaname='public' and tablename='events'
      and policyname='Church managers can insert events'
      and coalesce(with_check,'') ilike '%events%create%'
      and coalesce(with_check,'') ilike '%created_by%auth.uid%'
  ), 'Event create/actor policy missing';
  assert exists (
    select 1 from pg_policies where schemaname='public' and tablename='events'
      and policyname='Church managers can update events'
      and coalesce(qual,'') ilike '%events%edit%'
      and coalesce(qual,'') ilike '%events%manage%'
      and coalesce(qual,'') ilike '%created_by%auth.uid%'
  ), 'Event edit ownership/manage policy missing';
  assert exists (
    select 1 from pg_policies where schemaname='public' and tablename='events'
      and policyname='Church managers can delete events'
      and coalesce(qual,'') ilike '%events%delete%'
  ), 'Event delete policy missing';
  assert exists (
    select 1 from pg_trigger where tgrelid='public.events'::regclass
      and tgname='enforce_event_mutation_scope' and not tgisinternal
  ), 'Event scope trigger missing';
  assert exists (
    select 1 from pg_trigger where tgrelid='public.events'::regclass
      and tgname='enforce_tenant_actor_immutability' and not tgisinternal
  ), 'Event tenant/actor immutability trigger missing';
  assert exists (
    select 1 from pg_policies where schemaname='public' and tablename='announcements'
      and policyname='Church managers can update announcements'
      and coalesce(qual,'') ilike '%announcements%edit%'
      and coalesce(qual,'') ilike '%announcements%publish%'
  ), 'Announcement edit/publish admission policy missing';
  assert exists (
    select 1 from pg_policies where schemaname='public' and tablename='announcements'
      and policyname='Church managers can delete announcements'
      and coalesce(qual,'') ilike '%announcements%delete%'
  ), 'Announcement delete policy missing';
  assert exists (
    select 1 from pg_trigger where tgrelid='public.announcements'::regclass
      and tgname='enforce_announcement_action_permissions' and not tgisinternal
  ), 'Announcement combined-action trigger missing';
  assert exists (
    select 1 from pg_trigger where tgrelid='public.announcements'::regclass
      and tgname='enforce_tenant_actor_immutability' and not tgisinternal
  ), 'Announcement tenant/actor immutability trigger missing';

  select pg_get_functiondef('public.enforce_church_settings_manage_permission()'::regprocedure) into v_definition;
  assert v_definition ilike '%session_user in (%auth.uid() is null%service_role%',
    'Church settings trigger must honor an explicit authenticated context';
  select pg_get_functiondef('public.enforce_event_mutation_scope()'::regprocedure) into v_definition;
  assert v_definition ilike '%session_user in (%auth.uid() is null%service_role%',
    'Event scope trigger must honor an explicit authenticated context';
  select pg_get_functiondef('public.enforce_announcement_action_permissions()'::regprocedure) into v_definition;
  assert v_definition ilike '%session_user in (%auth.uid() is null%service_role%',
    'Announcement action trigger must honor an explicit authenticated context';
  select pg_get_functiondef('public.enforce_tenant_actor_immutability()'::regprocedure) into v_definition;
  assert v_definition ilike '%session_user in (%auth.uid() is null%service_role%',
    'Tenant/actor immutability trigger must honor an explicit authenticated context';

  select pg_get_functiondef('public.save_church_announcement(uuid,uuid,text,text,boolean,timestamptz,timestamptz,text,boolean,text[],text,text,boolean,text,text,boolean)'::regprocedure)
  into v_definition;
  assert v_definition ilike '%announcements%create%' and v_definition ilike '%announcements%edit%'
    and v_definition ilike '%announcements%publish%', 'Announcement save RPC action checks missing';
  assert v_definition not ilike '%can_manage_church_roles%' and v_definition not ilike '%role =%'
    and v_definition not ilike '%role in (%', 'Announcement save RPC introduced role-name authorization';
  select pg_get_functiondef('public.delete_church_announcement(uuid)'::regprocedure) into v_definition;
  assert v_definition ilike '%announcements%delete%', 'Announcement delete RPC action check missing';
end $$;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('e1000000-0000-4000-8000-000000000001','authenticated','authenticated','align-admin@test.invalid','',now(),'{}','{}',now(),now()),
  ('e2000000-0000-4000-8000-000000000002','authenticated','authenticated','align-secretary@test.invalid','',now(),'{}','{}',now(),now()),
  ('e3000000-0000-4000-8000-000000000003','authenticated','authenticated','align-member@test.invalid','',now(),'{}','{}',now(),now()),
  ('e4000000-0000-4000-8000-000000000004','authenticated','authenticated','align-publisher@test.invalid','',now(),'{}','{}',now(),now()),
  ('e5000000-0000-4000-8000-000000000005','authenticated','authenticated','align-other@test.invalid','',now(),'{}','{}',now(),now());

insert into public.churches (id,name,slug,phone) values
  ('ea000000-0000-4000-8000-000000000001','Mutation Alignment A','mutation-alignment-a','original'),
  ('eb000000-0000-4000-8000-000000000002','Mutation Alignment B','mutation-alignment-b','other');
insert into public.members (id,church_id,user_id,full_name,email,status) values
  ('ec000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Align Admin','align-admin@test.invalid','active'),
  ('ec000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','Align Secretary','align-secretary@test.invalid','active'),
  ('ec000000-0000-4000-8000-000000000003','ea000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000003','Align Member','align-member@test.invalid','active'),
  ('ec000000-0000-4000-8000-000000000004','ea000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000004','Align Publisher','align-publisher@test.invalid','active'),
  ('ec000000-0000-4000-8000-000000000005','eb000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000005','Align Other','align-other@test.invalid','active');
insert into public.user_roles (user_id,church_id,role) values
  ('e1000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001','church_admin'),
  ('e2000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000001','secretary'),
  ('e4000000-0000-4000-8000-000000000004','ea000000-0000-4000-8000-000000000001','publisher_only'),
  ('e5000000-0000-4000-8000-000000000005','eb000000-0000-4000-8000-000000000002','church_admin');

update public.subscriptions set plan='pro',status='active',started_at=now(),expires_at=now()+interval '7 days'
where church_id in ('ea000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000002');
-- Preserve mandatory recovery features as enabled and locked while making the
-- optional Event and Announcement fixtures available for mutation checks.
update public.church_features cf set enabled=true,locked=pf.is_mandatory from public.platform_features pf
where cf.feature_id=pf.id and pf.key in ('events','announcements','feature_permissions_admin')
  and cf.church_id in ('ea000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000002');
update public.church_role_permissions crp
set can_view=true,can_create=true,can_edit=true,can_delete=true,can_publish=true,can_manage=true
from public.platform_features pf where crp.feature_id=pf.id and crp.church_id='ea000000-0000-4000-8000-000000000001'
  and crp.role='secretary' and pf.key in ('events','announcements');
insert into public.church_role_permissions (church_id,role,feature_id,can_view,can_create,can_edit,can_delete,can_approve,can_publish,can_manage)
select 'ea000000-0000-4000-8000-000000000001','publisher_only',pf.id,true,false,false,false,false,true,false
from public.platform_features pf where pf.key='announcements'
on conflict (church_id,role,feature_id) do update set can_view=true,can_create=false,can_edit=false,can_delete=false,can_publish=true,can_manage=false;

-- Secretary cannot mutate settings despite same-tenant membership.
set local role authenticated;
set local request.jwt.claim.sub='e2000000-0000-4000-8000-000000000002';
update public.churches set phone='forbidden' where id='ea000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.assert_true((select phone='original' from public.churches where id='ea000000-0000-4000-8000-000000000001'),'Secretary changed Church settings');

-- Secretary Event CRUD is allowed; active-member permissions cannot edit another actor's Event.
set local role authenticated;
set local request.jwt.claim.sub='e2000000-0000-4000-8000-000000000002';
insert into public.events (id,title,description,church_id,created_by) values
  ('ed000000-0000-4000-8000-000000000001','Alignment Event','original','ea000000-0000-4000-8000-000000000001',auth.uid());
update public.events set description='secretary-edit' where id='ed000000-0000-4000-8000-000000000001';
reset role;
set local role authenticated;
set local request.jwt.claim.sub='e3000000-0000-4000-8000-000000000003';
update public.events set description='member-cross-owner-edit' where id='ed000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.assert_true((select description='secretary-edit' from public.events where id='ed000000-0000-4000-8000-000000000001'),'active member edited another actor''s Event');
set local role authenticated;
set local request.jwt.claim.sub='e2000000-0000-4000-8000-000000000002';
do $$ begin
  begin
    update public.events set created_by='e3000000-0000-4000-8000-000000000003' where id='ed000000-0000-4000-8000-000000000001';
    raise exception 'ASSERTION FAILED: Event created_by tamper succeeded';
  exception when insufficient_privilege then null; end;
end $$;
delete from public.events where id='ed000000-0000-4000-8000-000000000001';

-- Announcement direct operations work for configured grants.
insert into public.announcements (id,title,content,church_id,created_by,is_published) values
  ('ee000000-0000-4000-8000-000000000001','Alignment Announcement','original','ea000000-0000-4000-8000-000000000001',auth.uid(),false);
update public.announcements set content='secretary-edit' where id='ee000000-0000-4000-8000-000000000001';
update public.announcements set is_published=true where id='ee000000-0000-4000-8000-000000000001';
reset role;

-- Publish-only custom role cannot combine a content edit with publication transition.
set local role authenticated;
set local request.jwt.claim.sub='e4000000-0000-4000-8000-000000000004';
do $$ begin
  begin
    update public.announcements set content='forbidden-combined-edit',is_published=false
    where id='ee000000-0000-4000-8000-000000000001';
    raise exception 'ASSERTION FAILED: publish-only actor combined edit and publish';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  begin
    perform public.save_church_announcement(
      'ee000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001',
      'Alignment Announcement','forbidden-rpc-edit',false,null,null,'Africa/Nairobi',true,
      array['everyone']::text[],null,null,false,'none','general',false
    );
    raise exception 'ASSERTION FAILED: publish-only RPC combined edit and publish';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.assert_true((select content='secretary-edit' and is_published from public.announcements where id='ee000000-0000-4000-8000-000000000001'),'combined Announcement denial changed the row');

-- Secretary RPC actions align with direct-table grants.
set local role authenticated;
set local request.jwt.claim.sub='e2000000-0000-4000-8000-000000000002';
select public.save_church_announcement(null,'ea000000-0000-4000-8000-000000000001','RPC Announcement','RPC body',false,null,null,'Africa/Nairobi',true,array['everyone']::text[],null,null,false,'none','general',false);
select public.delete_church_announcement('ee000000-0000-4000-8000-000000000001');

select 'ok 1 - mutation permission alignment assertions passed';
rollback;
