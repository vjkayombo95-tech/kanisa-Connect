-- Slice 4: Diocese parish directory security contract

begin;

do $$
declare
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_diocese_a uuid := gen_random_uuid();
  v_diocese_b uuid := gen_random_uuid();
  v_church_a uuid := gen_random_uuid();
  v_church_b uuid := gen_random_uuid();
  v_church_inactive uuid := gen_random_uuid();
  v_count integer;
begin
  -- -----------------------------------------------------------------------
  -- Fixtures
  -- -----------------------------------------------------------------------

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
      'slice4-diocese-a@example.com',
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
      'slice4-diocese-b@example.com',
      '',
      now(),
      now(),
      now()
    );

  insert into public.dioceses (
    id,
    name,
    slug,
    status
  )
  values
    (
      v_diocese_a,
      'Slice 4 Diocese A',
      'slice-4-diocese-a',
      'active'
    ),
    (
      v_diocese_b,
      'Slice 4 Diocese B',
      'slice-4-diocese-b',
      'active'
    );

  insert into public.churches (
    id,
    name,
    code,
    address,
    email,
    phone,
    slug
  )
  values
    (
      v_church_a,
      'Slice 4 Parish A',
      'S4-A',
      'Address A',
      'parish-a@example.com',
      '+255700000001',
      'slice-4-parish-a'
    ),
    (
      v_church_b,
      'Slice 4 Parish B',
      'S4-B',
      'Address B',
      'parish-b@example.com',
      '+255700000002',
      'slice-4-parish-b'
    ),
    (
      v_church_inactive,
      'Slice 4 Inactive Parish',
      'S4-I',
      'Inactive Address',
      'inactive@example.com',
      '+255700000003',
      'slice-4-inactive-parish'
    );

  insert into public.diocese_churches (
    diocese_id,
    church_id,
    status
  )
  values
    (
      v_diocese_a,
      v_church_a,
      'active'
    ),
    (
      v_diocese_b,
      v_church_b,
      'active'
    ),
    (
      v_diocese_a,
      v_church_inactive,
      'inactive'
    );

  insert into public.diocese_staff (
    diocese_id,
    user_id,
    role,
    status
  )
  values
    (
      v_diocese_a,
      v_user_a,
      'diocese_staff',
      'active'
    ),
    (
      v_diocese_b,
      v_user_b,
      'diocese_staff',
      'active'
    );

  -- -----------------------------------------------------------------------
  -- User A: own Diocese
  -- -----------------------------------------------------------------------

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_user_a::text,
      'role', 'authenticated'
    )::text,
    true
  );

  select count(*)
    into v_count
  from public.get_diocese_parishes(v_diocese_a);

  if v_count <> 1 then
    raise exception
      'Expected user A to see exactly one active parish in Diocese A, got %',
      v_count;
  end if;

  if not exists (
    select 1
    from public.get_diocese_parishes(v_diocese_a) p
    where p.church_id = v_church_a
      and p.church_name = 'Slice 4 Parish A'
      and p.church_code = 'S4-A'
      and p.church_address = 'Address A'
      and p.church_email = 'parish-a@example.com'
      and p.church_phone = '+255700000001'
  ) then
    raise exception
      'Expected safe parish directory fields for Diocese A';
  end if;

  if exists (
    select 1
    from public.get_diocese_parishes(v_diocese_a) p
    where p.church_id = v_church_inactive
  ) then
    raise exception
      'Inactive Diocese parish assignment leaked into directory';
  end if;

  -- -----------------------------------------------------------------------
  -- Cross-Diocese isolation
  -- -----------------------------------------------------------------------

  select count(*)
    into v_count
  from public.get_diocese_parishes(v_diocese_b);

  if v_count <> 0 then
    raise exception
      'User A must not discover Diocese B parishes';
  end if;

  -- -----------------------------------------------------------------------
  -- Diocese visibility must not grant church administration
  -- -----------------------------------------------------------------------

  if public.is_church_admin(v_user_a, v_church_a) then
    raise exception
      'Diocese staff unexpectedly gained church admin authority';
  end if;

  -- -----------------------------------------------------------------------
  -- Inactive Diocese staff loses directory access
  -- -----------------------------------------------------------------------

  perform set_config('role', 'postgres', true);

  update public.diocese_staff
  set status = 'inactive'
  where diocese_id = v_diocese_a
    and user_id = v_user_a;

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_user_a::text,
      'role', 'authenticated'
    )::text,
    true
  );

  select count(*)
    into v_count
  from public.get_diocese_parishes(v_diocese_a);

  if v_count <> 0 then
    raise exception
      'Inactive Diocese staff must not retain parish directory access';
  end if;

  -- -----------------------------------------------------------------------
  -- RPC privilege contract
  -- -----------------------------------------------------------------------

  if not has_function_privilege(
    'authenticated',
    'public.get_diocese_parishes(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'Authenticated role must be able to execute get_diocese_parishes';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_diocese_parishes(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'Anon role must not execute get_diocese_parishes';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.is_diocese_staff(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception
      'Authenticated role must not directly execute is_diocese_staff';
  end if;

  raise notice 'Diocese parish directory security contract passed.';
end
$$;

rollback;
