CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name TEXT NOT NULL DEFAULT 'Kanisa Connect',
  support_email TEXT NOT NULL DEFAULT 'support@kanisaconnect.app',
  platform_description TEXT NOT NULL DEFAULT 'Church management platform for modern congregations.',
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  default_trial_days INTEGER NOT NULL DEFAULT 30,
  grace_period_days INTEGER NOT NULL DEFAULT 7,
  auto_expire_trials BOOLEAN NOT NULL DEFAULT true,
  allow_downgrades BOOLEAN NOT NULL DEFAULT true,
  welcome_email_subject TEXT NOT NULL DEFAULT 'Welcome to Kanisa Connect!',
  welcome_email_body TEXT NOT NULL DEFAULT 'Thank you for joining Kanisa Connect. Your church is now set up and ready to go.',
  invite_email_subject TEXT NOT NULL DEFAULT 'You''ve been invited to join a church on Kanisa Connect',
  invite_email_body TEXT NOT NULL DEFAULT 'You''ve been invited to join {church_name}. Click the link below to accept.',
  notify_new_church_registration BOOLEAN NOT NULL DEFAULT true,
  notify_payment_received BOOLEAN NOT NULL DEFAULT true,
  notify_subscription_expiring BOOLEAN NOT NULL DEFAULT true,
  notify_system_errors BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (platform_name)
SELECT 'Kanisa Connect'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can view platform settings"
ON public.platform_settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Super admins manage platform settings" ON public.platform_settings;
CREATE POLICY "Super admins manage platform settings"
ON public.platform_settings
FOR ALL
USING (true)
WITH CHECK (true);
