
-- =====================================================
-- KANISA CONNECT - Full Production Database Schema
-- Multi-tenant church management platform
-- =====================================================

-- =====================================================
-- 1. ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'church_admin', 'pastor', 'secretary', 'treasurer', 'member');
CREATE TYPE public.church_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.member_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE public.event_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');
CREATE TYPE public.event_request_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE public.event_request_type AS ENUM ('wedding', 'baptism', 'funeral', 'other');
CREATE TYPE public.prayer_status AS ENUM ('active', 'answered', 'archived');
CREATE TYPE public.mass_intention_status AS ENUM ('pending', 'scheduled', 'completed', 'archived');
CREATE TYPE public.help_request_status AS ENUM ('active', 'goal_reached', 'archived');
CREATE TYPE public.family_role AS ENUM ('father', 'mother', 'child', 'guardian', 'other');
CREATE TYPE public.gender_type AS ENUM ('male', 'female');
CREATE TYPE public.subscription_plan AS ENUM ('free', 'starter', 'growth', 'premium');
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'expired');
CREATE TYPE public.notification_type AS ENUM ('info', 'warning', 'success', 'error');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- =====================================================
-- 2. UTILITY FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_church_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := 'ECL-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.churches WHERE churches.code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- 3. CORE TABLES
-- =====================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE DEFAULT public.generate_church_code(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  banner_url TEXT,
  status public.church_status NOT NULL DEFAULT 'active',
  theme_color TEXT DEFAULT '#D4A017',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, church_id, role)
);

-- =====================================================
-- 4. SUBSCRIPTION & FEATURE MANAGEMENT
-- =====================================================

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name public.subscription_plan NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TZS',
  max_members INTEGER,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.platform_features(id) ON DELETE CASCADE,
  UNIQUE(plan_id, feature_id)
);

CREATE TABLE public.church_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 5. MEMBERS & PEOPLE
-- =====================================================

CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender public.gender_type,
  photo_url TEXT,
  date_of_birth DATE,
  address TEXT,
  status public.member_status NOT NULL DEFAULT 'active',
  date_joined DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_members_church ON public.members(church_id);
CREATE INDEX idx_members_user ON public.members(user_id);

CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_families_church ON public.families(church_id);

CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'other',
  UNIQUE(family_id, member_id)
);

-- =====================================================
-- 6. COMMUNITIES & MINISTRIES
-- =====================================================

CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  status public.church_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_communities_church ON public.communities(church_id);

CREATE TABLE public.community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_id, member_id)
);

CREATE TABLE public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  status public.church_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ministries_church ON public.ministries(church_id);

CREATE TABLE public.ministry_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ministry_id, member_id)
);

-- =====================================================
-- 7. EVENTS
-- =====================================================

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  status public.event_status NOT NULL DEFAULT 'upcoming',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_church ON public.events(church_id);

CREATE TABLE public.event_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  request_type public.event_request_type NOT NULL DEFAULT 'other',
  requester_name TEXT NOT NULL,
  requester_phone TEXT,
  description TEXT,
  preferred_date DATE,
  status public.event_request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_requests_church ON public.event_requests(church_id);

-- =====================================================
-- 8. CONTENT
-- =====================================================

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_church ON public.announcements(church_id);

CREATE TABLE public.sermons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  preacher TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT,
  audio_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sermons_church ON public.sermons(church_id);

CREATE TABLE public.bible_verses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 9. CONTRIBUTIONS
-- =====================================================

CREATE TABLE public.contribution_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_special BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contribution_categories_church ON public.contribution_categories(church_id);

CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.contribution_categories(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TZS',
  donor_name TEXT,
  phone TEXT,
  payment_reference TEXT,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contributions_church ON public.contributions(church_id);
CREATE INDEX idx_contributions_member ON public.contributions(member_id);
CREATE INDEX idx_contributions_date ON public.contributions(date);

-- =====================================================
-- 10. CARE & SERVICE
-- =====================================================

CREATE TABLE public.prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  request TEXT NOT NULL,
  status public.prayer_status NOT NULL DEFAULT 'active',
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  prayer_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prayer_requests_church ON public.prayer_requests(church_id);

CREATE TABLE public.mass_intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  intention_type TEXT NOT NULL DEFAULT 'thanksgiving',
  message TEXT NOT NULL,
  offering_amount NUMERIC(10,2),
  preferred_date DATE,
  status public.mass_intention_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mass_intentions_church ON public.mass_intentions(church_id);

CREATE TABLE public.community_help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  target_amount NUMERIC(12,2),
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.help_request_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_help_requests_church ON public.community_help_requests(church_id);

CREATE TABLE public.help_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id UUID NOT NULL REFERENCES public.community_help_requests(id) ON DELETE CASCADE,
  donor_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 11. NOTIFICATIONS & INVITATIONS
-- =====================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 12. AUDIT LOGS
-- =====================================================

CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_role TEXT,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  detail TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_church ON public.activity_logs(church_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- =====================================================
-- 13. TRIGGERS
-- =====================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_churches_updated_at BEFORE UPDATE ON public.churches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON public.families FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ministries_updated_at BEFORE UPDATE ON public.ministries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_event_requests_updated_at BEFORE UPDATE ON public.event_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sermons_updated_at BEFORE UPDATE ON public.sermons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prayer_requests_updated_at BEFORE UPDATE ON public.prayer_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mass_intentions_updated_at BEFORE UPDATE ON public.mass_intentions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_help_requests_updated_at BEFORE UPDATE ON public.community_help_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_church_subscriptions_updated_at BEFORE UPDATE ON public.church_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 14. SECURITY DEFINER HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_church_role(_user_id UUID, _church_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND church_id = _church_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_church_admin(_user_id UUID, _church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND church_id = _church_id
    AND role IN ('church_admin', 'pastor', 'secretary', 'treasurer')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_church_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT church_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_church_member(_user_id UUID, _church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND church_id = _church_id
  );
$$;

-- =====================================================
-- 15. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministry_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sermons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mass_intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_super_admin(auth.uid()));

-- CHURCHES
CREATE POLICY "Anyone can view active churches" ON public.churches FOR SELECT USING (status = 'active');
CREATE POLICY "Super admins can view all churches" ON public.churches FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage churches" ON public.churches FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Church admins can update own church" ON public.churches FOR UPDATE USING (public.is_church_admin(auth.uid(), id));
CREATE POLICY "Authenticated users can create churches" ON public.churches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SUPER ADMINS
CREATE POLICY "Super admins can view super_admins" ON public.super_admins FOR SELECT USING (public.is_super_admin(auth.uid()));

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Church admins can view church roles" ON public.user_roles FOR SELECT USING (public.is_church_admin(auth.uid(), church_id));
CREATE POLICY "Church admins can manage church roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_church_admin(auth.uid(), church_id));
CREATE POLICY "Church admins can delete church roles" ON public.user_roles FOR DELETE USING (public.is_church_admin(auth.uid(), church_id));

-- SUBSCRIPTION & FEATURES
CREATE POLICY "Anyone can view plans" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Super admins manage plans" ON public.subscription_plans FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Anyone can view features" ON public.platform_features FOR SELECT USING (true);
CREATE POLICY "Super admins manage features" ON public.platform_features FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Anyone can view plan features" ON public.plan_features FOR SELECT USING (true);
CREATE POLICY "Super admins manage plan features" ON public.plan_features FOR ALL USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Church members view own subscription" ON public.church_subscriptions FOR SELECT USING (public.is_church_member(auth.uid(), church_id));
CREATE POLICY "Super admins manage subscriptions" ON public.church_subscriptions FOR ALL USING (public.is_super_admin(auth.uid()));

-- MEMBERS
CREATE POLICY "Church members can view members" ON public.members FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can insert members" ON public.members FOR INSERT WITH CHECK (
  public.is_church_admin(auth.uid(), church_id)
);
CREATE POLICY "Church admins can update members" ON public.members FOR UPDATE USING (
  public.is_church_admin(auth.uid(), church_id)
);
CREATE POLICY "Church admins can delete members" ON public.members FOR DELETE USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- FAMILIES
CREATE POLICY "Church members can view families" ON public.families FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage families" ON public.families FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- FAMILY MEMBERS
CREATE POLICY "View family members" ON public.family_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.families f WHERE f.id = family_id AND (public.is_church_member(auth.uid(), f.church_id) OR public.is_super_admin(auth.uid())))
);
CREATE POLICY "Manage family members" ON public.family_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.families f WHERE f.id = family_id AND public.is_church_admin(auth.uid(), f.church_id))
);

-- COMMUNITIES
CREATE POLICY "Church members can view communities" ON public.communities FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage communities" ON public.communities FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- COMMUNITY MEMBERS
CREATE POLICY "View community members" ON public.community_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND (public.is_church_member(auth.uid(), c.church_id) OR public.is_super_admin(auth.uid())))
);
CREATE POLICY "Manage community members" ON public.community_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND public.is_church_admin(auth.uid(), c.church_id))
);

-- MINISTRIES
CREATE POLICY "Church members can view ministries" ON public.ministries FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage ministries" ON public.ministries FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- MINISTRY MEMBERS
CREATE POLICY "View ministry members" ON public.ministry_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ministry_id AND (public.is_church_member(auth.uid(), m.church_id) OR public.is_super_admin(auth.uid())))
);
CREATE POLICY "Manage ministry members" ON public.ministry_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ministry_id AND public.is_church_admin(auth.uid(), m.church_id))
);

-- EVENTS
CREATE POLICY "Church members can view events" ON public.events FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage events" ON public.events FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- EVENT REQUESTS
CREATE POLICY "Church members can view event requests" ON public.event_requests FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church members can create event requests" ON public.event_requests FOR INSERT WITH CHECK (
  public.is_church_member(auth.uid(), church_id)
);
CREATE POLICY "Church admins can manage event requests" ON public.event_requests FOR UPDATE USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- ANNOUNCEMENTS
CREATE POLICY "Church members can view published announcements" ON public.announcements FOR SELECT USING (
  (is_published = true AND public.is_church_member(auth.uid(), church_id)) OR
  public.is_church_admin(auth.uid(), church_id) OR
  public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage announcements" ON public.announcements FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- SERMONS
CREATE POLICY "Church members can view sermons" ON public.sermons FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage sermons" ON public.sermons FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- BIBLE VERSES
CREATE POLICY "Church members can view bible verses" ON public.bible_verses FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage bible verses" ON public.bible_verses FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- CONTRIBUTION CATEGORIES
CREATE POLICY "Church members can view categories" ON public.contribution_categories FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage categories" ON public.contribution_categories FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- CONTRIBUTIONS
CREATE POLICY "Church admins can view contributions" ON public.contributions FOR SELECT USING (
  public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Members can view own contributions" ON public.contributions FOR SELECT USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);
CREATE POLICY "Church admins can manage contributions" ON public.contributions FOR INSERT WITH CHECK (
  public.is_church_admin(auth.uid(), church_id)
);
CREATE POLICY "Church admins can update contributions" ON public.contributions FOR UPDATE USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- PRAYER REQUESTS
CREATE POLICY "Church members can view prayer requests" ON public.prayer_requests FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church members can create prayer requests" ON public.prayer_requests FOR INSERT WITH CHECK (
  public.is_church_member(auth.uid(), church_id)
);
CREATE POLICY "Church admins can manage prayer requests" ON public.prayer_requests FOR UPDATE USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- MASS INTENTIONS
CREATE POLICY "Church members can view mass intentions" ON public.mass_intentions FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church members can create mass intentions" ON public.mass_intentions FOR INSERT WITH CHECK (
  public.is_church_member(auth.uid(), church_id)
);
CREATE POLICY "Church admins can manage mass intentions" ON public.mass_intentions FOR UPDATE USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- COMMUNITY HELP REQUESTS
CREATE POLICY "Church members can view help requests" ON public.community_help_requests FOR SELECT USING (
  public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church members can create help requests" ON public.community_help_requests FOR INSERT WITH CHECK (
  public.is_church_member(auth.uid(), church_id)
);
CREATE POLICY "Church admins can manage help requests" ON public.community_help_requests FOR UPDATE USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- HELP DONATIONS
CREATE POLICY "View help donations" ON public.help_donations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.community_help_requests h WHERE h.id = help_request_id AND (public.is_church_member(auth.uid(), h.church_id) OR public.is_super_admin(auth.uid())))
);
CREATE POLICY "Create help donations" ON public.help_donations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.community_help_requests h WHERE h.id = help_request_id AND public.is_church_member(auth.uid(), h.church_id))
);

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Church admins can create notifications" ON public.notifications FOR INSERT WITH CHECK (
  church_id IS NULL OR public.is_church_admin(auth.uid(), church_id)
);

-- INVITATIONS
CREATE POLICY "Church admins can view invitations" ON public.invitations FOR SELECT USING (
  public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Church admins can manage invitations" ON public.invitations FOR ALL USING (
  public.is_church_admin(auth.uid(), church_id)
);

-- ACTIVITY LOGS
CREATE POLICY "Church admins can view logs" ON public.activity_logs FOR SELECT USING (
  (church_id IS NOT NULL AND public.is_church_admin(auth.uid(), church_id)) OR public.is_super_admin(auth.uid())
);
CREATE POLICY "System can insert logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 16. SEED DATA
-- =====================================================

INSERT INTO public.subscription_plans (name, display_name, price_monthly, price_yearly, max_members, description) VALUES
  ('free', 'Free', 0, 0, 50, 'Basic features for small churches'),
  ('starter', 'Starter', 25000, 250000, 200, 'Essential tools for growing churches'),
  ('growth', 'Growth', 75000, 750000, 1000, 'Advanced features for established churches'),
  ('premium', 'Premium', 150000, 1500000, NULL, 'Full platform access with unlimited members');

INSERT INTO public.platform_features (key, name, description, is_global) VALUES
  ('members', 'Member Management', 'Track and manage church members', true),
  ('contributions', 'Contributions & Giving', 'Record and track tithes and offerings', false),
  ('communities', 'Communities / Jumuiya', 'Manage small Christian communities', false),
  ('ministries', 'Ministries', 'Organize church ministries and teams', false),
  ('families', 'Family Management', 'Track family units within the church', false),
  ('events', 'Events & Calendar', 'Create and manage church events', true),
  ('event_requests', 'Event Requests', 'Allow members to request special events', false),
  ('announcements', 'Announcements', 'Publish church announcements', true),
  ('sermons', 'Sermons', 'Upload and share sermons', false),
  ('bible_verses', 'Bible Verses', 'Share daily bible verses', false),
  ('prayer_requests', 'Prayer Requests', 'Community prayer request board', false),
  ('mass_intentions', 'Mass Intentions', 'Submit and track mass intentions', false),
  ('community_help', 'Community Help', 'Crowdfunding for members in need', false),
  ('notifications', 'Notifications', 'Send targeted notifications', false),
  ('roles', 'Role Management', 'Manage user roles and permissions', false),
  ('reports', 'Reports & Analytics', 'Generate detailed reports', false);
