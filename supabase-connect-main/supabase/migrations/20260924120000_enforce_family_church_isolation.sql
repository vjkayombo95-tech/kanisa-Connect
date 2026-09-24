
-- Enforce family tenant isolation at the database level.
-- A member may have no family, but an assigned family must
-- belong to the same church as the member.

BEGIN;

-- Reject the migration if existing data violates the
-- intended constraints.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.families
    WHERE church_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce family isolation: families without church_id exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.members AS m
    JOIN public.families AS f
      ON f.id = m.family_id
    WHERE m.church_id IS DISTINCT FROM f.church_id
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce family isolation: cross-church family assignments exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.members
    WHERE family_id IS NOT NULL
      AND church_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce family isolation: assigned members without church_id exist';
  END IF;
END;
$$;

-- Every family must belong to a church.
ALTER TABLE public.families
  ALTER COLUMN church_id SET NOT NULL;

-- Required for the composite foreign key.
ALTER TABLE public.families
  ADD CONSTRAINT families_id_church_id_unique
  UNIQUE (id, church_id);

-- Prevent nullable church_id from bypassing
-- the composite foreign key.
ALTER TABLE public.members
  ADD CONSTRAINT members_family_requires_church
  CHECK (
    family_id IS NULL
    OR church_id IS NOT NULL
  );

-- Enforce that the assigned family belongs
-- to the same church as the member.
ALTER TABLE public.members
  ADD CONSTRAINT members_family_same_church_fkey
  FOREIGN KEY (family_id, church_id)
  REFERENCES public.families (id, church_id);

COMMIT;
