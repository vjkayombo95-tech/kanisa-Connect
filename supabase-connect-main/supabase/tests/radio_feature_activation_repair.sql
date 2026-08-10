\set ON_ERROR_STOP on
begin;

select '1..1';

-- Recreate the rollout ordering: churches exist, then a non-mandatory Radio
-- feature is inserted and the platform-feature trigger initially disables it.
update public.platform_features set key = 'radio_before_repair_test' where key = 'radio';

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1100000-0000-4000-8000-000000000001','authenticated','authenticated','radio-admin@test.invalid','',now(),'{}','{}',now(),now()),
  ('a1200000-0000-4000-8000-000000000002','authenticated','authenticated','radio-member@test.invalid','',now(),'{}','{}',now(),now());

insert into public.churches (id, name, slug) values
  ('a1300000-0000-4000-8000-000000000003','Radio Repair Disabled','radio-repair-disabled'),
  ('a1400000-0000-4000-8000-000000000004','Radio Repair Enabled','radio-repair-enabled');

insert into public.user_roles (id, user_id, church_id, role) values
  ('a1500000-0000-4000-8000-000000000005','a1100000-0000-4000-8000-000000000001','a1300000-0000-4000-8000-000000000003','church_admin'),
  ('a1600000-0000-4000-8000-000000000006','a1200000-0000-4000-8000-000000000002','a1300000-0000-4000-8000-000000000003','member');

update public.subscriptions
set plan = 'pro', status = 'active', started_at = now(), expires_at = now() + interval '7 days'
where church_id in (
  'a1300000-0000-4000-8000-000000000003',
  'a1400000-0000-4000-8000-000000000004'
);

insert into public.platform_features (
  key, name, description, is_global, globally_enabled, globally_locked,
  category, member_available, staff_available, available_plans
) values (
  'radio', 'Radio Repair Test', 'Radio activation repair regression fixture.',
  true, true, false, 'Engagement', true, true,
  array['free','basic','intermediate','pro','enterprise']::text[]
);

do $$
begin
  assert not exists (
    select 1
    from public.church_features cf
    join public.platform_features pf on pf.id = cf.feature_id
    where pf.key = 'radio' and cf.enabled
  ), 'Non-mandatory Radio rows should initially be disabled by the platform-feature trigger';
end;
$$;

update public.church_features cf
set enabled = true, enabled_at = '2026-08-01 00:00:00+00', updated_at = '2026-08-01 00:00:00+00'
from public.platform_features pf
where cf.feature_id = pf.id
  and pf.key = 'radio'
  and cf.church_id = 'a1400000-0000-4000-8000-000000000004';

-- Capture an unrelated feature row exactly as it stood before the repair.
create temporary table unrelated_feature_before as
select cf.id, cf.enabled, cf.enabled_at, cf.updated_at, cf.locked
from public.church_features cf
join public.platform_features pf on pf.id = cf.feature_id
where cf.church_id = 'a1300000-0000-4000-8000-000000000003'
  and pf.key = 'livestream';

-- Same statement as the forward-only migration.
update public.church_features cf
set
  enabled = true,
  enabled_at = coalesce(cf.enabled_at, now()),
  updated_at = now()
from public.platform_features pf
where cf.feature_id = pf.id
  and pf.key = 'radio'
  and cf.enabled is distinct from true;

do $$
begin
  assert exists (
    select 1 from public.church_features cf
    join public.platform_features pf on pf.id = cf.feature_id
    where pf.key = 'radio'
      and cf.church_id = 'a1300000-0000-4000-8000-000000000003'
      and cf.enabled and cf.enabled_at is not null
  ), 'Repair must enable a trigger-created disabled Radio row';

  assert exists (
    select 1 from public.church_features cf
    join public.platform_features pf on pf.id = cf.feature_id
    where pf.key = 'radio'
      and cf.church_id = 'a1400000-0000-4000-8000-000000000004'
      and cf.enabled
      and cf.enabled_at = '2026-08-01 00:00:00+00'
      and cf.updated_at = '2026-08-01 00:00:00+00'
  ), 'Already-enabled Radio rows must remain unchanged';

  assert not exists (
    select id, enabled, enabled_at, updated_at, locked from unrelated_feature_before
    except
    select cf.id, cf.enabled, cf.enabled_at, cf.updated_at, cf.locked
    from public.church_features cf
    join public.platform_features pf on pf.id = cf.feature_id
    where cf.church_id = 'a1300000-0000-4000-8000-000000000003'
      and pf.key = 'livestream'
  ), 'Unrelated feature rows must be unchanged';
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'a1100000-0000-4000-8000-000000000001';
do $$
begin
  assert public.has_church_feature_permission(
    auth.uid(), 'a1300000-0000-4000-8000-000000000003', 'radio', 'manage'
  ), 'Church Admin radio:manage must become true after repair';
end;
$$;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'a1200000-0000-4000-8000-000000000002';
do $$
begin
  assert public.has_church_feature_permission(
    auth.uid(), 'a1300000-0000-4000-8000-000000000003', 'radio', 'view'
  ), 'Member radio:view must remain valid';
  assert not public.has_church_feature_permission(
    auth.uid(), 'a1300000-0000-4000-8000-000000000003', 'radio', 'create'
  ), 'Member radio:create must remain false';
  assert not public.has_church_feature_permission(
    auth.uid(), 'a1300000-0000-4000-8000-000000000003', 'radio', 'edit'
  ), 'Member radio:edit must remain false';
  assert not public.has_church_feature_permission(
    auth.uid(), 'a1300000-0000-4000-8000-000000000003', 'radio', 'delete'
  ), 'Member radio:delete must remain false';
  assert not public.has_church_feature_permission(
    auth.uid(), 'a1300000-0000-4000-8000-000000000003', 'radio', 'manage'
  ), 'Member radio:manage must remain false';
end;
$$;

select 'ok 1 - Radio activation repair is scoped, idempotent, and permission-safe';
rollback;
