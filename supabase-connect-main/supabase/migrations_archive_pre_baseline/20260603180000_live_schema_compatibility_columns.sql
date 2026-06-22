-- Compatibility columns are optional on historic installations. Do not assume
-- that a renamed source column exists while backfilling a fresh schema.
DO $$
BEGIN
  IF to_regclass('public.contributions') IS NOT NULL THEN
    ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS date date;

    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'contributions'
          AND column_name IN ('date', 'created_at')) = 2 THEN
      UPDATE public.contributions
      SET date = coalesce(date, created_at::date, current_date)
      WHERE date IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contributions' AND column_name='date') THEN
      ALTER TABLE public.contributions ALTER COLUMN date SET DEFAULT current_date;
    END IF;
  END IF;

  IF to_regclass('public.bible_verses') IS NOT NULL THEN
    ALTER TABLE public.bible_verses
      ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id),
      ADD COLUMN IF NOT EXISTS "text" text,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS archived_at timestamptz;

    -- verse_text was used by a legacy schema; a new database only has text.
    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bible_verses'
          AND column_name IN ('text', 'verse_text')) = 2 THEN
      UPDATE public.bible_verses
      SET "text" = coalesce("text", verse_text)
      WHERE "text" IS NULL;
    END IF;
  END IF;
END $$;
