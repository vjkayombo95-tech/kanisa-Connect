
-- 1) Add submitted_by (auth user_id) to mass_intentions for member linkage
ALTER TABLE public.mass_intentions ADD COLUMN IF NOT EXISTS submitted_by uuid;

-- 2) Add submitted_by to community_help_requests for member linkage  
ALTER TABLE public.community_help_requests ADD COLUMN IF NOT EXISTS submitted_by uuid;

-- 3) Add 'pending' to help_request_status enum
ALTER TYPE public.help_request_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'active';

-- 4) Add member_id to prayer_requests if missing (it exists but let's ensure submitted_by too)
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS submitted_by uuid;

-- 5) Update RLS for community_help_requests: submitter can see own pending requests
CREATE POLICY "Submitters can view own help requests"
ON public.community_help_requests
FOR SELECT
USING (submitted_by = auth.uid());

-- 6) Update community_help default status to 'pending' for new member submissions
-- (We'll handle this in application code by explicitly setting status)
