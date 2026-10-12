-- KANISA CONNECT: Public Giving Staging duplicate reference check
--
-- READ ONLY. Run this operator-only SQL in the Supabase Staging SQL Editor
-- only after public_giving_staging_catalog_verification.sql confirms that
-- public.contributions exists and has church_id and payment_reference columns.
--
-- This query returns aggregate diagnostics only. It does not return donor names,
-- phone numbers, raw payment references, notes, contribution IDs, or submission IDs.

with duplicate_groups as (
  select
    church_id,
    count(*) as duplicate_count
  from public.contributions
  where payment_reference is not null
    and btrim(payment_reference) <> ''
  group by church_id, lower(btrim(payment_reference))
  having count(*) > 1
)
select
  'confirmed contribution duplicate normalized payment references' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  jsonb_build_object(
    'duplicate_group_count', count(*),
    'affected_church_count', count(distinct church_id),
    'max_rows_in_duplicate_group', coalesce(max(duplicate_count), 0),
    'note', 'Aggregate only. No donor names, phone numbers, raw payment references, notes, contribution ids, or submission ids are returned.'
  ) as detail
from duplicate_groups;
