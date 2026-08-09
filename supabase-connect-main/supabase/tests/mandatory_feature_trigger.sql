begin;

select '1..1';

-- Run only against a disposable database after all migrations. Every fixture
-- and attempted mutation is rolled back at the end of this file.
do $$
declare
  v_church_id uuid;
  v_other_church_id uuid;
  v_mandatory_feature_id uuid;
  v_optional_feature_id uuid;
begin
  insert into public.platform_features (
    key, name, globally_enabled, globally_locked, is_mandatory
  ) values (
    '__mandatory_trigger_optional_test__', 'Mandatory trigger optional test', true, false, false
  ) returning id into v_optional_feature_id;

  insert into public.churches (name, slug)
  values ('Mandatory trigger test church', 'mandatory-trigger-test-church')
  returning id into v_church_id;

  insert into public.churches (name, slug)
  values ('Mandatory trigger other church', 'mandatory-trigger-other-church')
  returning id into v_other_church_id;

  select id into strict v_mandatory_feature_id
  from public.platform_features
  where key = 'feature_permissions_admin';

  -- A normal non-mandatory row can be updated, deleted, and reinserted.
  update public.church_features
  set enabled = true
  where church_id = v_church_id and feature_id = v_optional_feature_id;

  delete from public.church_features
  where church_id = v_church_id and feature_id = v_optional_feature_id;

  insert into public.church_features (church_id, feature_id, enabled, locked)
  values (v_church_id, v_optional_feature_id, true, false);

  begin
    delete from public.church_features
    where church_id = v_church_id and feature_id = v_mandatory_feature_id;
    raise exception 'mandatory church feature deletion unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.church_features
    set enabled = false
    where church_id = v_church_id and feature_id = v_mandatory_feature_id;
    raise exception 'mandatory church feature disable unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.church_features
    set locked = false
    where church_id = v_church_id and feature_id = v_mandatory_feature_id;
    raise exception 'mandatory church feature unlock unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.church_features
    set feature_id = v_optional_feature_id
    where church_id = v_church_id and feature_id = v_mandatory_feature_id;
    raise exception 'mandatory church feature reassignment unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.church_features
    set church_id = v_other_church_id
    where church_id = v_church_id and feature_id = v_mandatory_feature_id;
    raise exception 'mandatory church feature tenant move unexpectedly succeeded';
  exception when check_violation then null;
  end;
end;
$$;

select 'ok 1 - mandatory feature trigger assertions passed';
rollback;
