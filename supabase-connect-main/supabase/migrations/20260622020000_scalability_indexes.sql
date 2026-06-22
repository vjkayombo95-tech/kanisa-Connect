-- High-frequency authorization, tenant-filter, and foreign-key indexes.
-- This is a forward-only migration: the production baseline remains unchanged.

-- Authorization helpers and RLS policies repeatedly resolve a user within a church.
CREATE INDEX IF NOT EXISTS idx_user_roles_user_church
  ON public.user_roles (user_id, church_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_church_role
  ON public.user_roles (church_id, role);

-- Tenant-scoped timeline and portal queries.
CREATE INDEX IF NOT EXISTS idx_announcements_church_created_at
  ON public.announcements (church_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_church_start_date
  ON public.events (church_id, start_date);

CREATE INDEX IF NOT EXISTS idx_mass_intentions_member_id
  ON public.mass_intentions (member_id);

CREATE INDEX IF NOT EXISTS idx_prayer_requests_member_id
  ON public.prayer_requests (member_id);

-- Frequently joined foreign keys used by RLS checks, chat, and tenant screens.
CREATE INDEX IF NOT EXISTS idx_churches_created_by
  ON public.churches (created_by);

CREATE INDEX IF NOT EXISTS idx_churches_owner_id
  ON public.churches (owner_id);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel_user
  ON public.chat_channel_members (channel_id, user_id);

CREATE INDEX IF NOT EXISTS idx_community_help_requests_church_id
  ON public.community_help_requests (church_id);

CREATE INDEX IF NOT EXISTS idx_community_help_requests_member_id
  ON public.community_help_requests (member_id);

CREATE INDEX IF NOT EXISTS idx_help_comments_help_request_id
  ON public.help_comments (help_request_id);

CREATE INDEX IF NOT EXISTS idx_help_comments_member_id
  ON public.help_comments (member_id);

CREATE INDEX IF NOT EXISTS idx_help_donations_help_request_id
  ON public.help_donations (help_request_id);

CREATE INDEX IF NOT EXISTS idx_families_church_id
  ON public.families (church_id);

CREATE INDEX IF NOT EXISTS idx_ministries_church_id
  ON public.ministries (church_id);

CREATE INDEX IF NOT EXISTS idx_invitations_church_id
  ON public.invitations (church_id);

CREATE INDEX IF NOT EXISTS idx_prayer_request_comments_member_id
  ON public.prayer_request_comments (member_id);

CREATE INDEX IF NOT EXISTS idx_prayer_request_prayers_member_id
  ON public.prayer_request_prayers (member_id);
