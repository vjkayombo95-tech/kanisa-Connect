ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.members.phone IS 'Store Tanzanian member phone numbers in E.164 format, e.g. +2557XXXXXXXX, for phone login lookup and future SMS OTP.';
COMMENT ON COLUMN public.members.phone_verified IS 'Reserved for future SMS OTP verification with Tanzania SMS providers.';
COMMENT ON COLUMN public.members.phone_verified_at IS 'Timestamp for future successful SMS OTP verification.';
