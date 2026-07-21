\set ON_ERROR_STOP on
begin;

create schema if not exists prayer_import_test;
create or replace function prayer_import_test.assert_true(value boolean, message text)
returns void language plpgsql as $$ begin if not coalesce(value, false) then raise exception 'ASSERTION FAILED: %', message; end if; end $$;
grant usage on schema prayer_import_test to service_role;
grant execute on function prayer_import_test.assert_true(boolean, text) to service_role;

select prayer_import_test.assert_true(
  (select prosecdef and proconfig @> array['search_path=public, pg_temp']
   from pg_proc where oid = 'public.apply_staging_prayer_import(text,text,jsonb,text,uuid)'::regprocedure),
  'actor-aware RPC is security definer with a safe search path'
);
select prayer_import_test.assert_true(
  has_function_privilege('service_role', 'public.apply_staging_prayer_import(text,text,jsonb,text,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_staging_prayer_import(text,text,jsonb,text,uuid)', 'execute'),
  'actor-aware RPC is service-role-only'
);
select prayer_import_test.assert_true(
  not has_function_privilege('authenticated', 'public.apply_staging_prayer_import(text,text,jsonb,text)', 'execute'),
  'browser users cannot bypass the Edge Function through the CLI overload'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'prayer-import-super@test.invalid', '', now(), '{}', '{"full_name":"Metadata Name"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'prayer-import-member@test.invalid', '', now(), '{}', '{}', now(), now());
insert into public.profiles (id, full_name, role) values
  ('e1000000-0000-4000-8000-000000000001', 'Verified Super Admin', 'super_admin'),
  ('e1000000-0000-4000-8000-000000000002', 'Ordinary Member', 'member')
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;
insert into public.super_admins (id) values ('e1000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://nunfrjcuimaytydnaqtt.supabase.co/auth/v1"}', true);
select set_config('request.headers', '{"host":"nunfrjcuimaytydnaqtt.supabase.co"}', true);
do $$ begin
  perform public.apply_staging_prayer_import('test.xlsx', repeat('A', 64), '[]'::jsonb, 'wrong', 'e1000000-0000-4000-8000-000000000001');
  raise exception 'authenticated browser bypassed the service boundary';
exception when insufficient_privilege then null; end $$;

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role","iss":"supabase"}', true);
select set_config('request.headers', '{"host":"cbaxiiqlzrwvmuplhusm.supabase.co"}', true);
do $$ begin
  perform public.apply_staging_prayer_import('test.xlsx', repeat('A', 64), '[]'::jsonb, 'wrong');
  raise exception 'production-host CLI was accepted';
exception when insufficient_privilege then null; end $$;

select set_config('request.headers', '{"host":"nunfrjcuimaytydnaqtt.supabase.co"}', true);
do $$ begin
  perform public.apply_staging_prayer_import('test.xlsx', repeat('A', 64), '[]'::jsonb, 'wrong');
  raise exception 'incorrect staging confirmation was accepted';
exception when invalid_parameter_value then null; end $$;

do $$ begin
  perform public.apply_staging_prayer_import(
    'test.xlsx', repeat('A', 64), '[]'::jsonb,
    'IMPORT_PRAYERS_TO_STAGING_AS_DRAFT',
    'e1000000-0000-4000-8000-000000000002'
  );
  raise exception 'non-Super-Admin initiator was accepted';
exception when insufficient_privilege then null; end $$;

do $$
declare
  v_first record;
  v_second record;
  v_third record;
  v_result jsonb;
  v_batch public.content_import_batches%rowtype;
  v_original_summary text;
begin
  select id, prayer_code, updated_at into v_first from public.content_prayers order by id limit 1;
  select id, prayer_code, updated_at into v_second from public.content_prayers order by id offset 1 limit 1;
  select id, prayer_code, updated_at, summary into v_third from public.content_prayers order by id offset 2 limit 1;

  v_result := public.apply_staging_prayer_import(
    'browser.xlsx', repeat('B', 64),
    jsonb_build_array(jsonb_build_object(
      'recordId', v_first.id, 'prayerCode', v_first.prayer_code,
      'expectedUpdatedAt', v_first.updated_at,
      'patch', jsonb_build_object('summary', 'browser actor audit test')
    )),
    'IMPORT_PRAYERS_TO_STAGING_AS_DRAFT',
    'e1000000-0000-4000-8000-000000000001'
  );
  select * into v_batch from public.content_import_batches where id = (v_result ->> 'batchId')::uuid;
  perform prayer_import_test.assert_true(v_batch.imported_by = 'e1000000-0000-4000-8000-000000000001', 'browser imported_by stores the initiating user');
  perform prayer_import_test.assert_true(v_batch.initiated_by_user_uuid = v_batch.imported_by, 'initiator UUID is recorded');
  perform prayer_import_test.assert_true(v_batch.initiated_by_email = 'prayer-import-super@test.invalid', 'email is derived from auth.users');
  perform prayer_import_test.assert_true(v_batch.initiated_by_display_name = 'Verified Super Admin', 'display name is derived from profiles');
  perform prayer_import_test.assert_true(v_batch.executed_by = 'service_role', 'service executor is recorded');
  perform prayer_import_test.assert_true(v_batch.status = 'Imported' and v_batch.updated_rows = 1 and v_batch.skipped_rows = 0, 'browser history counts are recorded');
  perform prayer_import_test.assert_true((select status = 'draft' and featured = false from public.content_prayers where id = v_first.id), 'browser update remains draft and non-featured');

  v_result := public.apply_staging_prayer_import(
    'cli.xlsx', repeat('C', 64),
    jsonb_build_array(jsonb_build_object(
      'recordId', v_second.id, 'prayerCode', v_second.prayer_code,
      'expectedUpdatedAt', v_second.updated_at,
      'patch', jsonb_build_object('summary', 'CLI actor audit test')
    )),
    'IMPORT_PRAYERS_TO_STAGING_AS_DRAFT'
  );
  select * into v_batch from public.content_import_batches where id = (v_result ->> 'batchId')::uuid;
  perform prayer_import_test.assert_true(v_batch.imported_by is null and v_batch.initiated_by_user_uuid is null, 'CLI keeps nullable initiating user fields');
  perform prayer_import_test.assert_true(v_batch.executed_by = 'service_role', 'CLI records service-role execution');

  v_original_summary := v_third.summary;
  begin
    perform public.apply_staging_prayer_import(
      'rollback.xlsx', repeat('D', 64),
      jsonb_build_array(
        jsonb_build_object(
          'recordId', v_third.id, 'prayerCode', v_third.prayer_code,
          'expectedUpdatedAt', v_third.updated_at,
          'patch', jsonb_build_object('summary', 'must roll back')
        ),
        jsonb_build_object(
          'recordId', v_third.id, 'prayerCode', v_third.prayer_code,
          'expectedUpdatedAt', v_third.updated_at,
          'patch', jsonb_build_object('summary', 'must also roll back')
        )
      ),
      'IMPORT_PRAYERS_TO_STAGING_AS_DRAFT',
      'e1000000-0000-4000-8000-000000000001'
    );
    raise exception 'concurrent-update rollback test unexpectedly succeeded';
  exception when serialization_failure then null;
  end;
  perform prayer_import_test.assert_true(
    (select summary is not distinct from v_original_summary from public.content_prayers where id = v_third.id),
    'a later failure rolls back earlier updates in the same import'
  );
  perform prayer_import_test.assert_true(
    not exists (select 1 from public.content_import_batches where filename = 'rollback.xlsx'),
    'rolled-back import does not leave history'
  );
end;
$$;

rollback;
