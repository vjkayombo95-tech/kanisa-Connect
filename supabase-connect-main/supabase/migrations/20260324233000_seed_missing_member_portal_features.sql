INSERT INTO public.platform_features (key, name, description, is_global, globally_enabled, globally_locked)
VALUES
  ('give', 'Give', 'Allow members to give through the member portal', true, true, false),
  ('pledges', 'Pledges', 'Allow members to view and manage pledge commitments', true, true, false),
  ('channels', 'Channels', 'Allow members to access portal channels and conversations', true, true, false)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_global = EXCLUDED.is_global;
