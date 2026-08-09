begin;

-- Database-level structural assertions. These run against a migrated disposable
-- database and intentionally do not require or modify production fixtures.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.has_church_feature_permission(uuid,uuid,text,text)'::regprocedure) into v_def;
  assert v_def ilike '%security definer%', 'permission helper must be SECURITY DEFINER';
  assert v_def ilike '%SET search_path TO %pg_catalog%public%', 'permission helper search_path must be restricted';
  assert not has_function_privilege('anon', 'public.has_church_feature_permission(uuid,uuid,text,text)', 'EXECUTE'), 'anon must not execute permission helper';
  assert has_function_privilege('authenticated', 'public.has_church_feature_permission(uuid,uuid,text,text)', 'EXECUTE'), 'authenticated must execute permission helper';
  assert exists (select 1 from public.platform_features where key = 'feature_permissions_admin' and is_mandatory), 'mandatory recovery feature missing';
  assert exists (select 1 from pg_trigger where tgname = 'protect_last_church_admin' and not tgisinternal), 'last-admin trigger missing';
  assert exists (select 1 from pg_trigger where tgname = 'provision_church_feature_permissions' and not tgisinternal), 'church provisioning trigger missing';
end $$;

-- With no JWT subject every input must deny, including an otherwise valid row.
select set_config('request.jwt.claims', '{}', true);
do $$
declare v_church uuid; v_feature text;
begin
  select cf.church_id, pf.key into v_church, v_feature
  from public.church_features cf join public.platform_features pf on pf.id = cf.feature_id
  limit 1;
  if v_church is not null then
    assert public.has_church_feature_permission(gen_random_uuid(), v_church, v_feature, 'view') = false;
  end if;
  assert public.has_church_feature_permission(gen_random_uuid(), gen_random_uuid(), '__unknown__', 'view') = false;
  assert public.has_church_feature_permission(gen_random_uuid(), gen_random_uuid(), 'members', '__unknown__') = false;
end $$;

rollback;
