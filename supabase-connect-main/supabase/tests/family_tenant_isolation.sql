
-- Family tenant isolation regression tests.
-- Run only against a disposable local test database
-- after applying the migration.

BEGIN;

DO $$
DECLARE
  v_church_a uuid;
  v_church_b uuid;
  v_family_id uuid;
  v_member_id uuid;
BEGIN
  -- Use two existing churches in the disposable test DB.
  SELECT id INTO v_church_a
  FROM public.churches
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_church_b
  FROM public.churches
  WHERE id <> v_church_a
  ORDER BY id
  LIMIT 1;

  IF v_church_a IS NULL OR v_church_b IS NULL THEN
    RAISE EXCEPTION
      'Test setup requires two churches in the local database';
  END IF;

  -- Create a family belonging to church A.
  INSERT INTO public.families (church_id, name)
  VALUES (v_church_a, 'Family isolation test')
  RETURNING id INTO v_family_id;

  -- Test 1: Families cannot have a NULL church.
  BEGIN
    INSERT INTO public.families (church_id, name)
    VALUES (NULL, 'Invalid family');

    RAISE EXCEPTION
      'FAIL: Family without church was accepted';
  EXCEPTION
    WHEN not_null_violation THEN
      RAISE NOTICE 'PASS: Family requires a church';
  END;

  -- Test 2: A member cannot be assigned to a
  -- family belonging to another church.
  BEGIN
    INSERT INTO public.members (
      full_name, church_id, family_id
    )
    VALUES (
      'Cross-church test member',
      v_church_b,
      v_family_id
    );

    RAISE EXCEPTION
      'FAIL: Cross-church assignment was accepted';
  EXCEPTION
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'PASS: Cross-church assignment rejected';
  END;

  -- Test 3: An assigned member must have a church.
  BEGIN
    INSERT INTO public.members (
      full_name, church_id, family_id
    )
    VALUES (
      'Missing-church test member',
      NULL,
      v_family_id
    );

    RAISE EXCEPTION
      'FAIL: Assigned member without church was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS: Assigned member requires a church';
  END;

  -- Test 4: A member without a family is allowed.
  INSERT INTO public.members (
    full_name, church_id, family_id
  )
  VALUES (
    'Unassigned test member',
    v_church_a,
    NULL
  )
  RETURNING id INTO v_member_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION
      'FAIL: Member without family was not created';
  END IF;

  RAISE NOTICE 'PASS: Member without family is allowed';
END;
$$;

ROLLBACK;
