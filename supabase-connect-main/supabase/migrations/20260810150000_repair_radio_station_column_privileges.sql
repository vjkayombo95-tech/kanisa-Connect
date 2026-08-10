-- Remove default broad table reads so metadata_url remains a Platform/Super
-- Admin-only technical field. Normal clients receive only the catalogue and
-- playback columns used by Church Admin and member experiences.
revoke select on table public.radio_stations from anon, authenticated;

grant select (
  id, name, stream_url, website_url, logo_url, description, provider,
  stream_format, is_active, is_approved, health_status,
  last_health_checked_at, created_at, updated_at
) on public.radio_stations to authenticated;
