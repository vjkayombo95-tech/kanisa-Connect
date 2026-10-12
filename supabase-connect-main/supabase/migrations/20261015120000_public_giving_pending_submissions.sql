-- Public Giving pending-verification backend.
--
-- This migration is forward-only. It creates the pending-submission table,
-- preserves the verified Staging RPC bodies, and keeps public submissions out
-- of confirmed contribution income until parish finance review approves them.

CREATE TABLE IF NOT EXISTS public.public_giving_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id uuid NOT NULL REFERENCES public.churches(id),
    contribution_type text NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100000000),
    currency text NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
    donor_name text NOT NULL CHECK (length(btrim(donor_name)) >= 2),
    phone text,
    payment_reference text,
    notes text,
    verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected')),
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    review_reason text,
    contribution_id uuid UNIQUE REFERENCES public.contributions(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT public_giving_reference_not_blank CHECK (payment_reference IS NULL OR length(btrim(payment_reference)) > 0),
    CONSTRAINT public_giving_review_consistency CHECK (
        (verification_status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND contribution_id IS NULL)
        OR (verification_status = 'rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND contribution_id IS NULL)
        OR (verification_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND contribution_id IS NOT NULL)
    )
);

DO $$
BEGIN
    IF to_regclass('public.public_giving_submissions_reference_unique') IS NULL
       AND EXISTS (
           SELECT 1
           FROM public.public_giving_submissions
           WHERE payment_reference IS NOT NULL
           GROUP BY church_id, lower(btrim(payment_reference))
           HAVING count(*) > 1
       )
    THEN
        RAISE EXCEPTION
            'Cannot create public_giving_submissions_reference_unique: duplicate normalized pending payment references exist';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS public_giving_submissions_reference_unique
 ON public.public_giving_submissions(church_id, lower(btrim(payment_reference)))
 WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS public_giving_submissions_pending_idx
 ON public.public_giving_submissions(church_id, created_at DESC)
 WHERE verification_status = 'pending';

DO $$
BEGIN
    IF to_regclass('public.contributions_church_payment_reference_unique') IS NULL
       AND EXISTS (
           SELECT 1
           FROM public.contributions
           WHERE payment_reference IS NOT NULL
             AND btrim(payment_reference) <> ''
           GROUP BY church_id, lower(btrim(payment_reference))
           HAVING count(*) > 1
       )
    THEN
        RAISE EXCEPTION
            'Cannot create contributions_church_payment_reference_unique: duplicate normalized confirmed payment references exist';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS contributions_church_payment_reference_unique
 ON public.contributions(church_id, lower(btrim(payment_reference)))
 WHERE payment_reference IS NOT NULL AND btrim(payment_reference) <> '';

ALTER TABLE public.public_giving_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_giving_submissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.public_giving_submissions TO service_role;

-- Exact exported Staging function definitions follow.

-- approve_public_giving_submission(p_submission_id uuid, p_payment_verified boolean)
CREATE OR REPLACE FUNCTION public.approve_public_giving_submission(p_submission_id uuid, p_payment_verified boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_submission public.public_giving_submissions%ROWTYPE;
    v_reviewer uuid := auth.uid();
    v_category_name text;
    v_category_id uuid;
    v_contribution_id uuid;
BEGIN
    IF v_reviewer IS NULL
       OR auth.role() <> 'authenticated'
    THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_submission
    FROM public.public_giving_submissions
    WHERE id = p_submission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    IF NOT (
        public.has_church_feature_permission(
            v_reviewer,
            v_submission.church_id,
            'contributions',
            'approve'
        )
        AND
        public.has_church_feature_permission(
            v_reviewer,
            v_submission.church_id,
            'contributions',
            'create'
        )
    ) THEN
        RAISE EXCEPTION 'Permission denied'
            USING ERRCODE = '42501';
    END IF;

    IF v_submission.verification_status <> 'pending' THEN
        RAISE EXCEPTION 'Submission has already been reviewed';
    END IF;

    IF p_payment_verified IS DISTINCT FROM true THEN
        RAISE EXCEPTION
            'Payment must be independently verified before approval';
    END IF;

    v_category_name :=
        CASE v_submission.contribution_type
            WHEN 'Sadaka' THEN 'Offering'
            WHEN 'Zaka' THEN 'Tithe'
            WHEN 'Jengo' THEN 'Building Fund'
            WHEN 'Shukrani' THEN 'Donations'
            WHEN 'Special Contribution' THEN 'Donations'
            ELSE NULL
        END;

    IF v_category_name IS NULL THEN
        RAISE EXCEPTION 'Unsupported contribution type';
    END IF;

    SELECT cc.id
    INTO v_category_id
    FROM public.contribution_categories cc
    WHERE cc.church_id = v_submission.church_id
      AND lower(cc.name) = lower(v_category_name)
    ORDER BY cc.id
    LIMIT 1;

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION
            'Required contribution category is missing: %',
            v_category_name;
    END IF;

    -- Duplicate-reference protection is also enforced
    -- by the unique index created in Step 214.
    IF v_submission.payment_reference IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.contributions c
           WHERE c.church_id = v_submission.church_id
             AND lower(btrim(c.payment_reference)) =
                 lower(btrim(v_submission.payment_reference))
       )
    THEN
        RAISE EXCEPTION
            'Payment reference has already been recorded';
    END IF;

    INSERT INTO public.contributions (
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
    VALUES (
        v_submission.church_id,
        v_submission.amount,
        v_category_id,
        v_submission.donor_name,
        v_submission.phone,
        v_submission.payment_reference,
        left(
            concat_ws(
                E'\n',
                'Verified public giving submission',
                'Type: ' || v_submission.contribution_type,
                CASE
                    WHEN v_submission.notes IS NOT NULL
                    THEN 'Note: ' || v_submission.notes
                END,
                'Submission ID: ' || v_submission.id::text
            ),
            1000
        ),
        CURRENT_DATE,
        v_reviewer
    )
    RETURNING id INTO v_contribution_id;

    UPDATE public.public_giving_submissions
    SET
        verification_status = 'approved',
        reviewed_by = v_reviewer,
        reviewed_at = now(),
        contribution_id = v_contribution_id
    WHERE id = v_submission.id;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_submission.id,
        'contribution_id', v_contribution_id,
        'status', 'approved'
    );
END;
$function$;


-- get_public_giving_church(p_slug_or_id text)
CREATE OR REPLACE FUNCTION public.get_public_giving_church(p_slug_or_id text)
 RETURNS TABLE(id uuid, name text, slug text, logo_url text, tagline text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_lookup text :=
        nullif(btrim(coalesce(p_slug_or_id, '')), '');

    v_lookup_uuid uuid;
BEGIN
    IF v_lookup IS NULL THEN
        RETURN;
    END IF;

    IF v_lookup ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
        v_lookup_uuid := v_lookup::uuid;
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.slug,
        c.logo_url,
        'Secure digital giving for your church community.'::text
    FROM public.churches c
    WHERE c.status = 'active'
      AND (
          lower(c.slug) = lower(v_lookup)
          OR (
              v_lookup_uuid IS NOT NULL
              AND c.id = v_lookup_uuid
          )
      )
      AND public.is_public_giving_available(c.id)
    ORDER BY
        CASE
            WHEN lower(c.slug) = lower(v_lookup)
            THEN 0
            ELSE 1
        END
    LIMIT 1;
END;
$function$;


-- is_public_giving_available(p_church_id uuid)
CREATE OR REPLACE FUNCTION public.is_public_giving_available(p_church_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
    SELECT
        p_church_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.churches c
            WHERE c.id = p_church_id
              AND c.status = 'active'
        )
        AND EXISTS (
            SELECT 1
            FROM public.platform_features pf
            JOIN public.church_features cf
              ON cf.feature_id = pf.id
             AND cf.church_id = p_church_id
             AND cf.enabled = true
            JOIN LATERAL (
                SELECT s.plan::text AS plan
                FROM public.subscriptions s
                WHERE s.church_id = p_church_id
                  AND s.status IN ('active', 'trial')
                  AND (
                      s.expires_at IS NULL
                      OR s.expires_at > now()
                  )
                ORDER BY s.started_at DESC
                LIMIT 1
            ) subscription ON true
            WHERE pf.key = 'give'
              AND pf.globally_enabled = true
              AND pf.globally_locked = false
              AND cf.locked = false
              AND subscription.plan = ANY(pf.available_plans)
        );
$function$;


-- list_pending_public_giving_submissions(p_church_id uuid)
CREATE OR REPLACE FUNCTION public.list_pending_public_giving_submissions(p_church_id uuid)
 RETURNS TABLE(submission_id uuid, church_id uuid, contribution_type text, amount numeric, currency text, donor_name text, phone text, payment_reference text, notes text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    -- Require authentication.
    IF v_user_id IS NULL
       OR auth.role() <> 'authenticated'
    THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- Require permission to review this parish's contributions.
    IF p_church_id IS NULL
       OR NOT COALESCE(
            public.has_church_feature_permission(
                v_user_id,
                p_church_id,
                'contributions',
                'approve'
            ),
            false
       )
    THEN
        RAISE EXCEPTION 'Permission denied'
            USING ERRCODE = '42501';
    END IF;

    -- Return pending submissions for this church only.
    RETURN QUERY
    SELECT
        s.id,
        s.church_id,
        s.contribution_type,
        s.amount,
        s.currency,
        s.donor_name,
        s.phone,
        s.payment_reference,
        s.notes,
        s.created_at
    FROM public.public_giving_submissions s
    WHERE s.church_id = p_church_id
      AND s.verification_status = 'pending'
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT 50;
END;
$function$;


-- reject_public_giving_submission(p_submission_id uuid, p_reason text)
CREATE OR REPLACE FUNCTION public.reject_public_giving_submission(p_submission_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_submission public.public_giving_submissions%ROWTYPE;
    v_reviewer uuid := auth.uid();
    v_reason text := nullif(btrim(p_reason), '');
BEGIN
    -- Require an authenticated reviewer.
    IF v_reviewer IS NULL
       OR auth.role() <> 'authenticated'
    THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- Lock the submission to prevent simultaneous reviews.
    SELECT *
    INTO v_submission
    FROM public.public_giving_submissions
    WHERE id = p_submission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    -- Only authorized parish financial reviewers may reject.
    IF NOT coalesce(
        public.has_church_feature_permission(
            v_reviewer,
            v_submission.church_id,
            'contributions',
            'approve'
        ),
        false
    ) THEN
        RAISE EXCEPTION 'Permission denied'
            USING ERRCODE = '42501';
    END IF;

    -- A reviewed submission cannot be reviewed again.
    IF v_submission.verification_status <> 'pending' THEN
        RAISE EXCEPTION 'Submission has already been reviewed';
    END IF;

    -- Require a meaningful rejection reason.
    IF v_reason IS NULL OR length(v_reason) < 5 THEN
        RAISE EXCEPTION
            'Rejection reason must contain at least 5 characters';
    END IF;

    IF length(v_reason) > 1000 THEN
        RAISE EXCEPTION
            'Rejection reason cannot exceed 1000 characters';
    END IF;

    UPDATE public.public_giving_submissions
    SET
        verification_status = 'rejected',
        reviewed_by = v_reviewer,
        reviewed_at = now(),
        review_reason = v_reason
    WHERE id = v_submission.id;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_submission.id,
        'status', 'rejected'
    );
END;
$function$;


-- submit_public_contribution(p_church_slug_or_id text, p_contribution_type text, p_amount numeric, p_donor_name text, p_phone text, p_note text, p_transaction_id text)
CREATE OR REPLACE FUNCTION public.submit_public_contribution(p_church_slug_or_id text, p_contribution_type text, p_amount numeric, p_donor_name text, p_phone text, p_note text DEFAULT NULL::text, p_transaction_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_church_id uuid;

    v_type text :=
        nullif(btrim(coalesce(p_contribution_type, '')), '');

    v_donor_name text :=
        nullif(btrim(coalesce(p_donor_name, '')), '');

    v_phone text :=
        regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');

    v_note text :=
        nullif(btrim(coalesce(p_note, '')), '');

    v_reference text :=
        nullif(btrim(coalesce(p_transaction_id, '')), '');

    v_scope text;
BEGIN
    SELECT church.id
    INTO v_church_id
    FROM public.get_public_giving_church(
        p_church_slug_or_id
    ) church
    LIMIT 1;

    IF v_church_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'We could not accept this submission.'
        );
    END IF;

    -- Rate-limit by church and phone rather than
    -- by a user-controlled transaction reference.
    v_scope :=
        v_church_id::text || ':' || lower(v_phone);

    IF v_type IS NULL
       OR v_type NOT IN (
           'Sadaka',
           'Zaka',
           'Jengo',
           'Shukrani',
           'Special Contribution'
       )
       OR p_amount IS NULL
       OR p_amount <= 0
       OR p_amount > 100000000
       OR v_donor_name IS NULL
       OR length(v_donor_name) < 2
       OR v_phone !~ '^\+?[0-9]{9,15}$'
       OR (
           v_reference IS NOT NULL
           AND v_reference !~ '^[A-Za-z0-9._-]{4,80}$'
       )
    THEN
        INSERT INTO public.security_audit_events(
            event_type,
            church_id,
            scope_key,
            metadata
        )
        VALUES (
            'public_contribution_rejected',
            v_church_id,
            v_scope,
            jsonb_build_object(
                'reason', 'validation_failed'
            )
        );

        RETURN jsonb_build_object(
            'success', false,
            'error',
            'We could not accept this submission. Please check your details.'
        );
    END IF;

    -- Preserve compatibility with previously recorded payments.
    IF v_reference IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.contributions c
           WHERE c.church_id = v_church_id
             AND lower(btrim(c.payment_reference)) =
                 lower(v_reference)
       )
    THEN
        RETURN jsonb_build_object(
            'success', true,
            'message',
            'This contribution was already received and is awaiting confirmation.'
        );
    END IF;

    -- Avoid disclosing whether a reference exists
    -- in the pending-submissions table.
    IF v_reference IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.public_giving_submissions s
           WHERE s.church_id = v_church_id
             AND lower(btrim(s.payment_reference)) =
                 lower(v_reference)
       )
    THEN
        RETURN jsonb_build_object(
            'success', true,
            'message',
            'Thank you. Your contribution has been submitted for confirmation.'
        );
    END IF;

    BEGIN
        PERFORM public.enforce_rate_limit(
            'public_contribution',
            v_scope,
            3,
            interval '15 minutes'
        );

    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.security_audit_events(
            event_type,
            church_id,
            scope_key,
            metadata
        )
        VALUES (
            'public_contribution_rate_limited',
            v_church_id,
            v_scope,
            '{}'::jsonb
        );

        RETURN jsonb_build_object(
            'success', false,
            'error',
            'Too many submissions. Please wait and try again.'
        );
    END;

    BEGIN
        INSERT INTO public.public_giving_submissions (
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
        VALUES (
            v_church_id,
            v_type,
            p_amount,
            'TZS',
            left(v_donor_name, 160),
            left(v_phone, 32),
            v_reference,
            left(v_note, 1000),
            'pending'
        );

    EXCEPTION
        WHEN unique_violation THEN
            RETURN jsonb_build_object(
                'success', true,
                'message',
                'Thank you. Your contribution has been submitted for confirmation.'
            );
    END;

    RETURN jsonb_build_object(
        'success', true,
        'message',
        'Thank you. Your contribution has been submitted for confirmation.'
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.is_public_giving_available(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_public_giving_available(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_public_giving_church(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_giving_church(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_public_contribution(text,text,numeric,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_contribution(text,text,numeric,text,text,text,text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_pending_public_giving_submissions(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_pending_public_giving_submissions(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_public_giving_submission(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_public_giving_submission(uuid,boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reject_public_giving_submission(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_public_giving_submission(uuid,text) TO authenticated, service_role;
