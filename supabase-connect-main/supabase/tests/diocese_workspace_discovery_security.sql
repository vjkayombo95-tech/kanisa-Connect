-- Diocese workspace discovery security tests.
--
-- Verifies that get_my_diocese_workspaces():
-- 1. is caller-bound;
-- 2. returns only active Diocese staff memberships;
-- 3. excludes inactive Dioceses;
-- 4. does not expose another user's Diocese;
-- 5. grants no church/parish authority.

begin;

do $$
declare
  v_diocese_a uuid := gen_random_uuid();
  v_diocese_b uuid := gen_random_uuid();
  v_diocese_inactive uuid := gen_random_uuid();

  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();

  v_church uuid;
  v_count integer;
  v_role text;
begin
  -- Reuse an existing church only for the church-authority isolation check.
  select id
    into v_church
  from public.churches
  limit 1;

  if v_church is null then
    raise exception 'Test requires at least one existing church';
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
  )
  values
    (
      v_user_a,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'diocese-workspace-a@example.test',
      '',
      now(),
      now(),
      now()
    ),
    (
      v_user_b,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'diocese-workspace-b@example.test',
      '',
      now(),
      now(),
      now()
    );

  insert into public.dioceses (id, name, slug, status)
  values
    (v_diocese_a, 'Workspace Diocese A', 'workspace-diocese-a', 'active'),
    (v_diocese_b, 'Workspace Diocese B', 'workspace-diocese-b', 'active'),
    (v_diocese_inactive, 'Inactive Workspace Diocese', 'inactive-workspace-diocese', 'inactive');

  insert into public.diocese_staff (diocese_id, user_id, role, status)
  values
    (v_diocese_a, v_user_a, 'diocese_secretary', 'active'),
    (v_diocese_b, v_user_b, 'diocese_admin', 'active'),
    (v_diocese_inactive, v_user_a, 'diocese_staff', 'active');

  -- ---------------------------------------------------------
  -- User A
  -- ---------------------------------------------------------

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);

  select count(*)
    into v_count
  from public.get_my_diocese_workspaces();

  if v_count <> 1 then
    raise exception
      'User A expected exactly 1 active Diocese workspace, got %',
      v_count;
  end if;

  select staff_role
    into v_role
  from public.get_my_diocese_workspaces()
  where diocese_id = v_diocese_a;

  if v_role is distinct from 'diocese_secretary' then
    raise exception
      'User A expected diocese_secretary role, got %',
      v_role;
  end if;

  if exists (
    select 1
    from public.get_my_diocese_workspaces()
    where diocese_id = v_diocese_b
  ) then
    raise exception 'User A can discover User B Diocese workspace';
  end if;

  if exists (
    select 1
    from public.get_my_diocese_workspaces()
    where diocese_id = v_diocese_inactive
  ) then
    raise exception 'Inactive Diocese was returned to User A';
  end if;

  if public.current_user_can_view_diocese(v_diocese_b) then
    raise exception 'User A can view unrelated Diocese B';
  end if;

  -- Diocese membership must not imply church authorization.
  if public.is_church_admin(v_user_a, v_church) then
    raise exception 'Diocese staff unexpectedly gained church admin authority';
  end if;

  -- ---------------------------------------------------------
  -- User B
  -- ---------------------------------------------------------

  perform set_config('request.jwt.claim.sub', v_user_b::text, true);

  select count(*)
    into v_count
  from public.get_my_diocese_workspaces();

  if v_count <> 1 then
    raise exception
      'User B expected exactly 1 active Diocese workspace, got %',
      v_count;
  end if;

  if not exists (
    select 1
    from public.get_my_diocese_workspaces()
    where diocese_id = v_diocese_b
      and staff_role = 'diocese_admin'
  ) then
    raise exception 'User B expected Diocese B admin workspace';
  end if;

  if exists (
    select 1
    from public.get_my_diocese_workspaces()
    where diocese_id = v_diocese_a
  ) then
    raise exception 'User B can discover User A Diocese workspace';
  end if;

  -- ---------------------------------------------------------
  -- Inactive membership
  -- ---------------------------------------------------------

  update public.diocese_staff
  set status = 'inactive'
  where diocese_id = v_diocese_b
    and user_id = v_user_b;

  select count(*)
    into v_count
  from public.get_my_diocese_workspaces();

  if v_count <> 0 then
    raise exception
      'Inactive Diocese staff membership still returned % workspace(s)',
      v_count;
  end if;

  raise notice 'Diocese workspace discovery security tests PASS';
end
$$;

rollback;

-- ---------------------------------------------------------------------------
-- Regression: arbitrary-user Diocese membership helper must remain private.
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.is_diocese_staff(uuid, uuid)',
    'EXECUTE'
  ) then
    raise exception
      'authenticated unexpectedly has EXECUTE on is_diocese_staff(uuid, uuid)';
  end if;

  if has_function_privilege(
    'anon',
    'public.is_diocese_staff(uuid, uuid)',
    'EXECUTE'
  ) then
    raise exception
      'anon unexpectedly has EXECUTE on is_diocese_staff(uuid, uuid)';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_my_diocese_workspaces()',
    'EXECUTE'
  ) then
    raise exception
      'authenticated must have EXECUTE on caller-bound get_my_diocese_workspaces()';
  end if;

  raise notice 'Diocese workspace RPC privilege regression tests PASS';
end
$$;
