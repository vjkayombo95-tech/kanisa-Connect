\set ON_ERROR_STOP on
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

create or replace function pg_temp.assert_false(_condition boolean, _label text)
returns void language plpgsql as $$
begin
  if coalesce(_condition, false) then
    raise exception 'FAIL: %', _label;
  end if;
  raise notice 'PASS: %', _label;
end;
$$;

create or replace function pg_temp.assert_raises_sqlstate_message(
  _sql text,
  _expected_sqlstate text,
  _expected_message_fragment text,
  _label text
)
returns void language plpgsql as $$
declare
  v_sqlstate text;
  v_message text;
begin
  begin
    execute _sql;
  exception
    when others then
      get stacked diagnostics
        v_sqlstate = returned_sqlstate,
        v_message = message_text;

      if v_sqlstate <> _expected_sqlstate then
        raise exception 'FAIL: % expected SQLSTATE %, got % (%)',
          _label, _expected_sqlstate, v_sqlstate, v_message;
      end if;

      if _expected_message_fragment is not null
         and position(_expected_message_fragment in v_message) = 0 then
        raise exception 'FAIL: % expected message containing %, got %',
          _label, _expected_message_fragment, v_message;
      end if;

      raise notice 'PASS: %', _label;
      return;
  end;

  raise exception 'FAIL: % expected SQLSTATE % but no exception was raised',
    _label, _expected_sqlstate;
end;
$$;

create temporary table public_giving_test_ids (
  reference text primary key,
  submission_id uuid not null
);

grant select on public_giving_test_ids to authenticated;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('a3300000-0000-4000-8000-000000000001', 'pg-treasurer-a@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('a3300000-0000-4000-8000-000000000002', 'pg-treasurer-b@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('a3300000-0000-4000-8000-000000000003', 'pg-ordinary@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('a3300000-0000-4000-8000-000000000004', 'pg-diocese-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('a3300000-0000-4000-8000-000000000005', 'pg-owner@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, code, status, created_by)
values
  ('a3310000-0000-4000-8000-000000000001', 'Public Giving Parish A', 'public-giving-parish-a', 'PG-A', 'active', 'a3300000-0000-4000-8000-000000000005'),
  ('a3310000-0000-4000-8000-000000000002', 'Public Giving Parish B', 'public-giving-parish-b', 'PG-B', 'active', 'a3300000-0000-4000-8000-000000000005');

insert into public.dioceses (id, name, slug, status, created_by)
values ('a3320000-0000-4000-8000-000000000001', 'Public Giving Diocese', 'public-giving-diocese', 'active', 'a3300000-0000-4000-8000-000000000004');

insert into public.diocese_churches (id, diocese_id, church_id, status, added_by)
values ('a3330000-0000-4000-8000-000000000001', 'a3320000-0000-4000-8000-000000000001', 'a3310000-0000-4000-8000-000000000001', 'active', 'a3300000-0000-4000-8000-000000000004');

insert into public.diocese_staff (id, diocese_id, user_id, role, status)
values ('a3340000-0000-4000-8000-000000000001', 'a3320000-0000-4000-8000-000000000001', 'a3300000-0000-4000-8000-000000000004', 'diocese_admin', 'active');

insert into public.members (id, church_id, user_id, full_name, email, status)
values
  ('a3350000-0000-4000-8000-000000000001', 'a3310000-0000-4000-8000-000000000001', 'a3300000-0000-4000-8000-000000000001', 'Treasurer A', 'pg-treasurer-a@test.invalid', 'active'),
  ('a3350000-0000-4000-8000-000000000002', 'a3310000-0000-4000-8000-000000000002', 'a3300000-0000-4000-8000-000000000002', 'Treasurer B', 'pg-treasurer-b@test.invalid', 'active'),
  ('a3350000-0000-4000-8000-000000000003', 'a3310000-0000-4000-8000-000000000001', 'a3300000-0000-4000-8000-000000000003', 'Ordinary Member', 'pg-ordinary@test.invalid', 'active');

insert into public.user_roles (user_id, church_id, role)
values
  ('a3300000-0000-4000-8000-000000000001', 'a3310000-0000-4000-8000-000000000001', 'treasurer'),
  ('a3300000-0000-4000-8000-000000000002', 'a3310000-0000-4000-8000-000000000002', 'treasurer'),
  ('a3300000-0000-4000-8000-000000000003', 'a3310000-0000-4000-8000-000000000001', 'member');

update public.subscriptions set plan = 'basic', status = 'active', started_at = now() where church_id in ('a3310000-0000-4000-8000-000000000001', 'a3310000-0000-4000-8000-000000000002');

insert into public.platform_features (
  id, key, name, description, globally_enabled, globally_locked,
  member_available, staff_available, available_plans
)
values
  ('a3370000-0000-4000-8000-000000000001', 'give', 'Give', 'Public giving', true, false, true, true, array['basic','intermediate','pro','enterprise']),
  ('a3370000-0000-4000-8000-000000000002', 'contributions', 'Contributions', 'Contribution management', true, false, false, true, array['basic','intermediate','pro','enterprise'])
on conflict (key) do update set
  globally_enabled = excluded.globally_enabled,
  globally_locked = excluded.globally_locked,
  member_available = excluded.member_available,
  staff_available = excluded.staff_available,
  available_plans = excluded.available_plans;

insert into public.church_features (church_id, feature_id, enabled, locked)
select fixture.church_id, pf.id, true, false
from (values
  ('a3310000-0000-4000-8000-000000000001'::uuid, 'give'::text),
  ('a3310000-0000-4000-8000-000000000001'::uuid, 'contributions'::text),
  ('a3310000-0000-4000-8000-000000000002'::uuid, 'give'::text),
  ('a3310000-0000-4000-8000-000000000002'::uuid, 'contributions'::text)
) as fixture(church_id, feature_key)
join public.platform_features pf on pf.key = fixture.feature_key
on conflict (church_id, feature_id) do update set enabled = true, locked = false;

insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_approve
)
select church_id, role, pf.id, true, can_create, can_approve
from (values
  ('a3310000-0000-4000-8000-000000000001'::uuid, 'treasurer'::text, true, true),
  ('a3310000-0000-4000-8000-000000000002'::uuid, 'treasurer'::text, true, true),
  ('a3310000-0000-4000-8000-000000000001'::uuid, 'member'::text, false, false)
) as fixture(church_id, role, can_create, can_approve)
join public.platform_features pf on pf.key = 'contributions'
on conflict (church_id, role, feature_id) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_approve = excluded.can_approve;

insert into public.contribution_categories (id, church_id, name, description, is_special)
values
  ('a3380000-0000-4000-8000-000000000001', 'a3310000-0000-4000-8000-000000000001', 'Offering', 'Offering', false),
  ('a3380000-0000-4000-8000-000000000002', 'a3310000-0000-4000-8000-000000000001', 'Tithe', 'Tithe', false),
  ('a3380000-0000-4000-8000-000000000003', 'a3310000-0000-4000-8000-000000000001', 'Building Fund', 'Building Fund', true),
  ('a3380000-0000-4000-8000-000000000004', 'a3310000-0000-4000-8000-000000000001', 'Donations', 'Donations', false),
  ('a3380000-0000-4000-8000-000000000005', 'a3310000-0000-4000-8000-000000000002', 'Offering', 'Offering', false);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);

select pg_temp.assert_true(
  (public.submit_public_contribution(
    'public-giving-parish-a', 'Sadaka', 12000, 'Public Donor',
    '+255700000001', 'Sunday gift', 'PGREF-001'
  )->>'success')::boolean,
  'Anonymous public submission succeeds'
);

reset role;

insert into public_giving_test_ids (reference, submission_id)
select payment_reference, id
from public.public_giving_submissions
where payment_reference = 'PGREF-001';

select pg_temp.assert_true(
  exists (
    select 1
    from public.public_giving_submissions
    where church_id = 'a3310000-0000-4000-8000-000000000001'
      and payment_reference = 'PGREF-001'
      and verification_status = 'pending'
  ),
  'Anonymous public submission is stored as pending'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.contributions
    where church_id = 'a3310000-0000-4000-8000-000000000001'
      and payment_reference = 'PGREF-001'
  ),
  'Pending submission is excluded from confirmed income'
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);

select public.submit_public_contribution(
  'public-giving-parish-a', 'Sadaka', 12000, 'Duplicate Donor',
  '+255700000002', 'Duplicate gift', ' pgref-001 '
);

reset role;

select pg_temp.assert_true(
  (
    select count(*)
    from public.public_giving_submissions
    where church_id = 'a3310000-0000-4000-8000-000000000001'
      and lower(btrim(payment_reference)) = 'pgref-001'
  ) = 1,
  'Duplicate pending reference is accepted idempotently without a second pending row'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'pg-treasurer-a@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"pg-treasurer-a@test.invalid"}', true);

select pg_temp.assert_true(
  exists (
    select 1
    from public.list_pending_public_giving_submissions('a3310000-0000-4000-8000-000000000001')
    where payment_reference = 'PGREF-001'
  ),
  'Authorized Treasurer can list own parish pending submissions'
);

select pg_temp.assert_raises_sqlstate_message(
  'select public.approve_public_giving_submission((select submission_id from public_giving_test_ids where reference = ''PGREF-001''), false)',
  'P0001',
  'Payment must be independently verified before approval',
  'Approval without independent payment verification is denied'
);

select pg_temp.assert_raises_sqlstate_message(
  'select public.list_pending_public_giving_submissions(''a3310000-0000-4000-8000-000000000002'')',
  '42501',
  'Permission denied',
  'Treasurer cannot list another parish submissions'
);

select public.approve_public_giving_submission(
  (select submission_id from public_giving_test_ids where reference = 'PGREF-001'),
  true
);

reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from public.public_giving_submissions s
    join public.contributions c on c.id = s.contribution_id
    where s.payment_reference = 'PGREF-001'
      and s.verification_status = 'approved'
      and c.payment_reference = 'PGREF-001'
  ),
  'Authorized approval creates a confirmed contribution'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'pg-treasurer-a@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"pg-treasurer-a@test.invalid"}', true);

select pg_temp.assert_raises_sqlstate_message(
  'select public.approve_public_giving_submission((select submission_id from public_giving_test_ids where reference = ''PGREF-001''), true)',
  'P0001',
  'Submission has already been reviewed',
  'Double approval is prevented'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);

select public.submit_public_contribution(
  'public-giving-parish-a', 'Zaka', 25000, 'Reject Donor',
  '+255700000003', 'Reject this one', 'PGREF-REJECT'
);

select public.submit_public_contribution(
  'public-giving-parish-a', 'Jengo', 30000, 'Member Denied Donor',
  '+255700000004', 'Member denied', 'PGREF-MEMBER'
);

select public.submit_public_contribution(
  'public-giving-parish-a', 'Shukrani', 35000, 'Diocese Denied Donor',
  '+255700000005', 'Diocese denied', 'PGREF-DIOCESE'
);

reset role;

insert into public.contributions (
  id,
  church_id,
  amount,
  category_id,
  donor_name,
  phone,
  payment_reference,
  notes,
  date,
  created_by
)
values (
  'a3390000-0000-4000-8000-000000000001',
  'a3310000-0000-4000-8000-000000000001',
  45000,
  'a3380000-0000-4000-8000-000000000001',
  'Already Confirmed Donor',
  '+255700000006',
  'PGREF-CONFIRMED',
  'Existing confirmed contribution fixture',
  current_date,
  'a3300000-0000-4000-8000-000000000001'
);

insert into public.public_giving_submissions (
  id,
  church_id,
  contribution_type,
  amount,
  currency,
  donor_name,
  phone,
  payment_reference,
  notes,
  verification_status
)
values (
  'a33a0000-0000-4000-8000-000000000001',
  'a3310000-0000-4000-8000-000000000001',
  'Sadaka',
  45000,
  'TZS',
  'Pending Duplicate Donor',
  '+255700000007',
  'PGREF-CONFIRMED',
  'Should be blocked on approval',
  'pending'
);

insert into public_giving_test_ids (reference, submission_id)
select payment_reference, id
from public.public_giving_submissions
where payment_reference in ('PGREF-REJECT', 'PGREF-MEMBER', 'PGREF-DIOCESE', 'PGREF-CONFIRMED');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3300000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'pg-ordinary@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"pg-ordinary@test.invalid"}', true);

select pg_temp.assert_raises_sqlstate_message(
  'select public.list_pending_public_giving_submissions(''a3310000-0000-4000-8000-000000000001'')',
  '42501',
  'Permission denied',
  'Ordinary member cannot list pending submissions'
);

select pg_temp.assert_raises_sqlstate_message(
  'select public.reject_public_giving_submission((select submission_id from public_giving_test_ids where reference = ''PGREF-MEMBER''), ''Not authorized'')',
  '42501',
  'Permission denied',
  'Ordinary member cannot review pending submissions'
);

select set_config('request.jwt.claim.sub', 'a3300000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.email', 'pg-diocese-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"pg-diocese-admin@test.invalid"}', true);

select pg_temp.assert_raises_sqlstate_message(
  'select public.list_pending_public_giving_submissions(''a3310000-0000-4000-8000-000000000001'')',
  '42501',
  'Permission denied',
  'Diocese Admin without parish finance permission cannot list pending submissions'
);

select pg_temp.assert_raises_sqlstate_message(
  'select public.reject_public_giving_submission((select submission_id from public_giving_test_ids where reference = ''PGREF-DIOCESE''), ''Not authorized'')',
  '42501',
  'Permission denied',
  'Diocese Admin without parish finance permission cannot review pending submissions'
);

select set_config('request.jwt.claim.sub', 'a3300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'pg-treasurer-a@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"pg-treasurer-a@test.invalid"}', true);

select pg_temp.assert_raises_sqlstate_message(
  'select public.approve_public_giving_submission((select submission_id from public_giving_test_ids where reference = ''PGREF-CONFIRMED''), true)',
  'P0001',
  'Payment reference has already been recorded',
  'Approval is denied when the payment reference already exists in confirmed contributions'
);

select public.reject_public_giving_submission(
  (select submission_id from public_giving_test_ids where reference = 'PGREF-REJECT'),
  'Reference not found'
);

reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from public.public_giving_submissions
    where payment_reference = 'PGREF-REJECT'
      and verification_status = 'rejected'
      and contribution_id is null
  ),
  'Authorized rejection marks submission rejected without confirmed income'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3300000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'pg-treasurer-a@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"pg-treasurer-a@test.invalid"}', true);

select pg_temp.assert_raises_sqlstate_message(
  'select public.approve_public_giving_submission((select submission_id from public_giving_test_ids where reference = ''PGREF-REJECT''), true)',
  'P0001',
  'Submission has already been reviewed',
  'Rejected submission cannot subsequently be approved'
);

reset role;

select pg_temp.assert_false(
  has_table_privilege('anon', 'public.public_giving_submissions', 'SELECT')
    or has_table_privilege('anon', 'public.public_giving_submissions', 'INSERT')
    or has_table_privilege('authenticated', 'public.public_giving_submissions', 'SELECT')
    or has_table_privilege('authenticated', 'public.public_giving_submissions', 'INSERT'),
  'Direct client table access to public_giving_submissions is denied'
);

select pg_temp.assert_true(
  has_table_privilege('service_role', 'public.public_giving_submissions', 'SELECT')
    and has_table_privilege('service_role', 'public.public_giving_submissions', 'INSERT')
    and has_table_privilege('service_role', 'public.public_giving_submissions', 'UPDATE'),
  'service_role retains direct table access for backend operations'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.submit_public_contribution(text,text,numeric,text,text,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.submit_public_contribution(text,text,numeric,text,text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.submit_public_contribution(text,text,numeric,text,text,text,text)', 'EXECUTE'),
  'submit_public_contribution grants match Staging'
);

select pg_temp.assert_false(
  has_function_privilege('anon', 'public.is_public_giving_available(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.is_public_giving_available(uuid)', 'EXECUTE'),
  'is_public_giving_available is denied to anon and authenticated'
);

select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.is_public_giving_available(uuid)', 'EXECUTE'),
  'is_public_giving_available is executable by service_role'
);

select pg_temp.assert_false(
  has_function_privilege('anon', 'public.list_pending_public_giving_submissions(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.approve_public_giving_submission(uuid,boolean)', 'EXECUTE')
    or has_function_privilege('anon', 'public.reject_public_giving_submission(uuid,text)', 'EXECUTE'),
  'anon cannot execute pending review RPCs'
);

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.list_pending_public_giving_submissions(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.approve_public_giving_submission(uuid,boolean)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.reject_public_giving_submission(uuid,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.list_pending_public_giving_submissions(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.approve_public_giving_submission(uuid,boolean)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.reject_public_giving_submission(uuid,text)', 'EXECUTE'),
  'authenticated and service_role can execute pending review RPCs'
);

rollback;
