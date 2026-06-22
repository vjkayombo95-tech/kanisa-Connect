# Staging checklist

- [ ] Staging Supabase project is separate from production, including Auth and Storage.
- [ ] CLI is linked to the staging project ref and `supabase status` confirms it.
- [ ] All migrations apply through `supabase db push` and `supabase migration list` is clean.
- [ ] Tables, public RPCs, RLS policies, and Storage buckets have been verified using the queries in `STAGING_SETUP.md`.
- [ ] Netlify staging context has the five required `VITE_*` variables; no production value was changed.
- [ ] Browser console reports `environment: staging` and the staging project ref.
- [ ] Red staging banner is visible on every page.
- [ ] Staging login accounts are synthetic and use no production personal data.
- [ ] Seed SQL has been reviewed and is run only after confirming the staging project ref.
- [ ] At least two churches and two roles have passed isolation/RLS checks.
- [ ] k6 variables target staging and the intended script/virtual-user level has been approved.
- [ ] Backups, observability, rate-limit dashboards, and a staging reset plan exist before heavy load testing.
