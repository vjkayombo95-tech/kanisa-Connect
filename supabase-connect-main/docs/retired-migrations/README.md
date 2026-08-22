# Retired migrations

Files in this directory are historical records only. They are not executable Supabase migrations.

## `20260810160000_share_live_media_view_permissions.sql`

This staging-only migration was committed with the shared Live Media UI but was never applied to live staging and never entered the authoritative production migration lineage. Review found that applying it would grant Radio and Livestream view access to 24 pastor, secretary, or treasurer permission tuples across four non-UAT churches, beyond current production behavior.

The SQL is retained unchanged for auditability. It must not be restored to `supabase/migrations` without an explicit authorization and production-parity review.
