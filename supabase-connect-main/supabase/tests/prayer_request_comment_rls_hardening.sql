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

create or replace function pg_temp.assert_raises_rls(_sql text, _label text)
returns void language plpgsql as $$
begin
  begin
    execute _sql;
    raise exception 'FAIL: %', _label;
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: %', _label;
  end;
end;
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('41000000-0000-4000-8000-000000000001', 'prayer-owner-a@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('41000000-0000-4000-8000-000000000002', 'prayer-member-a@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('41000000-0000-4000-8000-000000000003', 'prayer-admin-a@uat.invalid', 'authenticated', 'authenticated', now(), now()),
  ('41000000-0000-4000-8000-000000000004', 'prayer-member-b@uat.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, church_code, owner_id, created_by) values
  ('42000000-0000-4000-8000-000000000001', 'Prayer Comment Church A', 'prayer-comment-church-a', 'KC-PRC-TST-001', '41000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000003'),
  ('42000000-0000-4000-8000-000000000002', 'Prayer Comment Church B', 'prayer-comment-church-b', 'KC-PRC-TST-002', '41000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000004');

insert into public.members (id, church_id, user_id, full_name, status) values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Prayer Owner A', 'active'),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002', 'Prayer Member A', 'active'),
  ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000004', 'Prayer Member B', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'member'),
  ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', 'member'),
  ('41000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000001', 'church_admin'),
  ('41000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000002', 'member');

insert into public.prayer_requests
  (id, member_id, church_id, request_text, request, status, privacy, is_anonymous)
values
  ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Private request', 'Private request', 'pending', 'private_to_pastor_admin', false),
  ('44000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Pending public request', 'Pending public request', 'pending', 'public_to_church', false),
  ('44000000-0000-4000-8000-000000000003', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Rejected public request', 'Rejected public request', 'rejected', 'public_to_church', false),
  ('44000000-0000-4000-8000-000000000004', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Approved public request', 'Approved public request', 'approved', 'public_to_church', false),
  ('44000000-0000-4000-8000-000000000005', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Approved anonymous request', 'Approved anonymous request', 'approved', 'anonymous_public', true),
  ('44000000-0000-4000-8000-000000000006', '43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000002', 'Other church request', 'Other church request', 'approved', 'public_to_church', false);

insert into public.prayer_request_comments
  (id, prayer_request_id, church_id, member_id, author_name, comment)
values
  ('45000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Owner A', 'Private comment'),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Owner A', 'Pending comment'),
  ('45000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Owner A', 'Rejected comment'),
  ('45000000-0000-4000-8000-000000000004', '44000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Owner A', 'Approved comment'),
  ('45000000-0000-4000-8000-000000000005', '44000000-0000-4000-8000-000000000005', '42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Owner A', 'Anonymous comment'),
  ('45000000-0000-4000-8000-000000000006', '44000000-0000-4000-8000-000000000006', '42000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000003', 'Member B', 'Other church comment');

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000001'),
  'owner can read comments on own private prayer'
);
select pg_temp.assert_true(
  exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000002'),
  'owner can read comments on own pending prayer'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000004'),
  'same-church member can read approved public prayer comments'
);
select pg_temp.assert_true(
  exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000005'),
  'same-church member can read approved anonymous prayer comments'
);
select pg_temp.assert_true(
  not exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000001'),
  'unrelated same-church member cannot read private parent comments'
);
select pg_temp.assert_true(
  not exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000002'),
  'unrelated same-church member cannot read pending parent comments'
);
select pg_temp.assert_true(
  not exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000003'),
  'unrelated same-church member cannot read rejected parent comments'
);
select pg_temp.assert_true(
  not exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000006'),
  'cross-church member cannot read comments'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000001'),
  'authorized reviewer can read private parent comments'
);
select pg_temp.assert_true(
  exists (select 1 from public.prayer_request_comments where id = '45000000-0000-4000-8000-000000000002'),
  'authorized reviewer can read pending parent comments'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
insert into public.prayer_request_comments
  (id, prayer_request_id, church_id, member_id, author_name, comment)
values
  ('45000000-0000-4000-8000-000000000007', '44000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000002', 'Member A', 'Legitimate approved shared comment');
select pg_temp.assert_true(true, 'legitimate member can insert comment on visible approved shared prayer');

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
insert into public.prayer_request_comments
  (id, prayer_request_id, church_id, member_id, author_name, comment)
values
  ('45000000-0000-4000-8000-000000000008', '44000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Owner A', 'Owner private comment');
select pg_temp.assert_true(true, 'owner can insert comment on own visible prayer');

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_raises_rls(
  $$insert into public.prayer_request_comments
    (id, prayer_request_id, church_id, member_id, author_name, comment)
    values (
      '45000000-0000-4000-8000-000000000009',
      '44000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000002',
      'Member A',
      'Hidden pending comment'
    )$$,
  'caller cannot insert comment against hidden pending parent prayer'
);
select pg_temp.assert_raises_rls(
  $$insert into public.prayer_request_comments
    (id, prayer_request_id, church_id, member_id, author_name, comment)
    values (
      '45000000-0000-4000-8000-000000000010',
      '44000000-0000-4000-8000-000000000004',
      '42000000-0000-4000-8000-000000000002',
      '43000000-0000-4000-8000-000000000002',
      'Member A',
      'Mismatched church comment'
    )$$,
  'comment church_id cannot differ from parent church_id'
);
select pg_temp.assert_raises_rls(
  $$insert into public.prayer_request_comments
    (id, prayer_request_id, church_id, member_id, author_name, comment)
    values (
      '45000000-0000-4000-8000-000000000011',
      '44000000-0000-4000-8000-000000000004',
      '42000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000001',
      'Spoofed Owner',
      'Spoofed member identity comment'
    )$$,
  'caller cannot spoof another member identity'
);

rollback;
