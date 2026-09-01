import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building2,
  Church,
  Lock,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  User,
  X,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Radio,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useLedCommunities } from "@/hooks/use-community-leader";
import { isAdminRole, type AppRole } from "@/lib/role-utils";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { Card, CardContent } from "@/components/ui/card";
import { BibleVersePopup } from "@/components/portal/BibleVersePopup";
import { MemberMobileBackHeader } from "@/components/portal/MemberMobileBackHeader";
import { formatTZS } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { getPortalFeatureForPath, type PortalFeatureKey } from "@/lib/portal-features";
import { isOrdinaryMemberPathAllowed } from "@/lib/member-service-registry";
import { AppLink } from "@/components/AppLink";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { MemberNotificationBell } from "@/components/portal/MemberNotificationBell";
import { useMemberNotifications } from "@/hooks/use-member-notifications";
import { useTranslation } from "react-i18next";
import {
  AnnouncementsIcon,
  BibleIcon,
  ChannelsIcon,
  CommunitiesIcon,
  CommunityHelpIcon,
  ContributionsIcon,
  DashboardIcon,
  EventsIcon,
  MassIntentionsIcon,
  PledgesIcon,
  PortalIcon,
  PrayerIcon,
  SermonsIcon,
} from "@/components/church-admin/sidebar-icons";

type PortalIconComponent = (props: { active?: boolean; className?: string }) => ReactNode;

const LiturgicalCalendarIcon: PortalIconComponent = ({ className }) => <CalendarDays className={className} />;
const RadioIcon: PortalIconComponent = ({ className }) => <Radio className={className} />;
const ParishIcon: PortalIconComponent = ({ className }) => <Church className={className} />;

type NavItem = {
  titleKey: string;
  url: string;
  icon: PortalIconComponent;
  featureKey: PortalFeatureKey | null;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const FULL_MAIN_ITEMS: NavItem[] = [
  { titleKey: "home", url: "/portal", icon: DashboardIcon, featureKey: null },
  { titleKey: "Watakatifu", url: "/member/library", icon: BibleIcon, featureKey: null },
  { titleKey: "Kalenda ya Liturujia", url: "/portal/liturgical-calendar", icon: LiturgicalCalendarIcon, featureKey: null },
  { titleKey: "Masomo ya Leo", url: "/portal/daily-readings", icon: BibleIcon, featureKey: null },
  { titleKey: "Bible", url: "/portal/bible", icon: BibleIcon, featureKey: null },
  { titleKey: "events", url: "/portal/events", icon: EventsIcon, featureKey: "events" },
  { titleKey: "announcements", url: "/portal/announcements", icon: AnnouncementsIcon, featureKey: "announcements" },
  { titleKey: "give", url: "/portal/give", icon: ContributionsIcon, featureKey: "give" },
];

const FULL_GROUPS: NavGroup[] = [
  {
    id: "spiritual",
    label: "Spiritual",
    items: [
      { titleKey: "sermons", url: "/portal/sermons", icon: SermonsIcon, featureKey: "sermons" },
      { titleKey: "Radio", url: "/portal/radio", icon: RadioIcon, featureKey: "radio" },
      { titleKey: "bible_verses", url: "/portal/bible-verses", icon: BibleIcon, featureKey: "bible_verses" },
      { titleKey: "prayer_requests", url: "/portal/prayer-requests", icon: PrayerIcon, featureKey: "prayer_requests" },
      { titleKey: "mass_intentions", url: "/portal/mass-intentions", icon: MassIntentionsIcon, featureKey: "mass_intentions" },
    ],
  },
  {
    id: "community",
    label: "Community",
    items: [
      // This portal currently has no standalone communities page, so channels is used as the member-facing group space.
      { titleKey: "communities", url: "/portal/channels", icon: CommunitiesIcon, featureKey: "channels" },
      { titleKey: "channels", url: "/portal/channels", icon: ChannelsIcon, featureKey: "channels" },
      { titleKey: "community_help", url: "/portal/community-help", icon: CommunityHelpIcon, featureKey: "community_help" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { titleKey: "pledges", url: "/portal/pledges", icon: PledgesIcon, featureKey: "pledges" },
      // Contribution history already lives on the member dashboard experience.
      { titleKey: "my_dashboard", url: "/portal/dashboard", icon: ContributionsIcon, featureKey: null },
    ],
  },
];

const SIMPLE_MEMBER_MAIN_ITEMS: NavItem[] = [
  { titleKey: "Leo", url: "/portal/today", icon: BibleIcon, featureKey: null },
  { titleKey: "Parokia Yangu", url: "/portal/my-parish", icon: ParishIcon, featureKey: null },
  { titleKey: "Nyumbani", url: "/portal", icon: DashboardIcon, featureKey: null },
  { titleKey: "Zaidi", url: "/portal/services", icon: PortalIcon, featureKey: null },
  { titleKey: "Watakatifu", url: "/member/library", icon: BibleIcon, featureKey: null },
  { titleKey: "Kalenda ya Liturujia", url: "/portal/liturgical-calendar", icon: LiturgicalCalendarIcon, featureKey: null },
  { titleKey: "Masomo ya Leo", url: "/portal/daily-readings", icon: BibleIcon, featureKey: null },
  { titleKey: "Biblia", url: "/portal/bible", icon: BibleIcon, featureKey: null },
  { titleKey: "Lipa", url: "/portal/give", icon: ContributionsIcon, featureKey: "give" },
  { titleKey: "Nia za Misa", url: "/portal/mass-intentions", icon: MassIntentionsIcon, featureKey: "mass_intentions" },
  { titleKey: "Matangazo", url: "/portal/announcements", icon: AnnouncementsIcon, featureKey: "announcements" },
  { titleKey: "Historia Yangu", url: "/portal/dashboard", icon: PortalIcon, featureKey: null },
];

const LIMITED_MAIN_ITEMS: NavItem[] = [
  { titleKey: "home", url: "/portal", icon: DashboardIcon, featureKey: null },
  { titleKey: "Bible", url: "/portal/bible", icon: BibleIcon, featureKey: null },
  { titleKey: "events", url: "/portal/events", icon: EventsIcon, featureKey: "events" },
  { titleKey: "announcements", url: "/portal/announcements", icon: AnnouncementsIcon, featureKey: "announcements" },
];

const LIMITED_GROUPS: NavGroup[] = [
  {
    id: "spiritual",
    label: "Spiritual",
    items: [{ titleKey: "sermons", url: "/portal/sermons", icon: SermonsIcon, featureKey: "sermons" }],
  },
];

const DESKTOP_SIDEBAR_GROUPS: NavGroup[] = [
  {
    id: "primary",
    label: "Primary",
    items: [
      { titleKey: "Nyumbani", url: "/portal", icon: DashboardIcon, featureKey: null },
      { titleKey: "Leo", url: "/portal/today", icon: BibleIcon, featureKey: null },
      { titleKey: "Parokia Yangu", url: "/portal/my-parish", icon: ParishIcon, featureKey: null },
    ],
  },
  {
    id: "services",
    label: "Huduma",
    items: [
      { titleKey: "Michango", url: "/portal/give", icon: ContributionsIcon, featureKey: "give" },
      { titleKey: "Nia za Misa", url: "/portal/mass-intentions", icon: MassIntentionsIcon, featureKey: "mass_intentions" },
      { titleKey: "Kalenda", url: "/portal/calendar", icon: EventsIcon, featureKey: "events" },
      { titleKey: "Matangazo", url: "/portal/announcements", icon: AnnouncementsIcon, featureKey: "announcements" },
      { titleKey: "Huduma", url: "/portal/ministries", icon: CommunitiesIcon, featureKey: "ministries" },
    ],
  },
  {
    id: "spiritual",
    label: "Kiroho",
    items: [
      { titleKey: "Biblia", url: "/portal/bible", icon: BibleIcon, featureKey: null },
      { titleKey: "Masomo ya Leo", url: "/portal/daily-readings", icon: BibleIcon, featureKey: null },
      { titleKey: "Sala", url: "/portal/prayers", icon: PrayerIcon, featureKey: null },
      { titleKey: "Mahubiri", url: "/portal/sermons", icon: SermonsIcon, featureKey: "sermons" },
    ],
  },
  {
    id: "media",
    label: "Media",
    items: [
      { titleKey: "Radio", url: "/portal/radio", icon: RadioIcon, featureKey: "radio" },
    ],
  },
];

const DESKTOP_SIDEBAR_MORE_ITEM: NavItem = {
  titleKey: "Zaidi",
  url: "/portal/services",
  icon: PortalIcon,
  featureKey: null,
};

function isActive(pathname: string, url: string) {
  return url === "/portal" ? pathname === "/portal" : pathname.startsWith(url);
}

function findDesktopGroupForPath(groups: NavGroup[], pathname: string) {
  return groups.find((group) => group.id !== "primary" && group.items.some((item) => isActive(pathname, item.url)))?.id ?? null;
}

function DesktopSidebarLink({
  item,
  pathname,
  t,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  t: ReturnType<typeof useTranslation>["t"];
  collapsed: boolean;
}) {
  const active = isActive(pathname, item.url);
  const Icon = item.icon;
  const label = t(item.titleKey);

  return (
    <AppLink
      to={item.url}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      data-active={active ? "true" : "false"}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all",
        "border-transparent text-muted-foreground hover:border-primary/20 hover:bg-primary/8 hover:text-foreground",
        active && "border-primary/25 bg-primary/12 text-primary shadow-[0_18px_38px_-30px_rgba(250,204,21,0.75)]",
        collapsed && "justify-center px-2",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors",
          active
            ? "border-primary/25 bg-primary/15 text-primary"
            : "border-border/50 bg-background/35 text-muted-foreground group-hover:border-primary/20 group-hover:text-foreground",
        )}
      >
        <Icon active={active} className="h-4 w-4" />
      </span>
      {!collapsed ? <span className="min-w-0 truncate">{label}</span> : null}
    </AppLink>
  );
}

function MemberDesktopSidebar({
  groups,
  pathname,
  t,
  collapsed,
  setCollapsed,
  expandedGroups,
  toggleGroup,
}: {
  groups: NavGroup[];
  pathname: string;
  t: ReturnType<typeof useTranslation>["t"];
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  expandedGroups: string[];
  toggleGroup: (groupId: string) => void;
}) {
  return (
    <aside
      data-testid="member-desktop-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "relative sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 border-r border-primary/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.9),rgba(11,15,20,0.96))] px-3 py-3 shadow-[22px_0_70px_-55px_rgba(0,0,0,0.95)] backdrop-blur-2xl after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-[linear-gradient(180deg,transparent,rgba(250,204,21,0.22),rgba(148,163,184,0.12),transparent)] after:content-[''] lg:flex lg:flex-col",
        collapsed ? "w-[5.25rem]" : "w-60",
      )}
    >
      <div className={cn("mb-3 flex items-center gap-2 px-1", collapsed ? "justify-center" : "justify-between")}>
        <div className={cn("flex min-w-0 items-center gap-3", collapsed && "hidden")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-gold shadow-[0_18px_32px_-22px_rgba(250,204,21,0.8)]">
            <Church className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold font-serif text-foreground">Kanisa Connect</p>
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70">Member</p>
          </div>
        </div>
        {collapsed ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-gold shadow-[0_18px_32px_-22px_rgba(250,204,21,0.8)]">
            <Church className="h-5 w-5 text-primary-foreground" />
          </div>
        ) : null}
        <button
          type="button"
          aria-label={collapsed ? "Expand member sidebar" : "Collapse member sidebar"}
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/55 bg-background/30 text-muted-foreground transition-colors hover:border-primary/25 hover:bg-primary/8 hover:text-primary",
            collapsed && "absolute left-[4.1rem] z-10 bg-background/90 shadow-lg",
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
        </button>
      </div>

      <nav
        aria-label="Member desktop navigation"
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((group) => {
          const activeWithin = group.items.some((item) => isActive(pathname, item.url));
          const primaryGroup = group.id === "primary";
          const groupOpen = collapsed || primaryGroup || expandedGroups.includes(group.id);

          return (
            <section key={group.id} aria-label={group.label} className="space-y-1">
              {!collapsed && primaryGroup ? (
                <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/45">
                  {group.label}
                </p>
              ) : null}
              {!collapsed && !primaryGroup ? (
                <button
                  type="button"
                  aria-expanded={groupOpen}
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "flex min-h-8 w-full items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 transition-colors hover:bg-primary/6 hover:text-muted-foreground",
                    activeWithin && "text-primary/75",
                  )}
                >
                  <span className="min-w-0 truncate">{group.label}</span>
                  {groupOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                </button>
              ) : null}
              {groupOpen
                ? group.items.map((item) => (
                    <DesktopSidebarLink
                      key={`${group.id}-${item.url}`}
                      item={item}
                      pathname={pathname}
                      t={t}
                      collapsed={collapsed}
                    />
                  ))
                : null}
            </section>
          );
        })}
        <div className="border-t border-border/45 pt-2">
          <DesktopSidebarLink
            item={DESKTOP_SIDEBAR_MORE_ITEM}
            pathname={pathname}
            t={t}
            collapsed={collapsed}
          />
        </div>
      </nav>

    </aside>
  );
}

function ProfileMenu({
  profileMenuOpen,
  setProfileMenuOpen,
  profile,
  ledCommunities,
  handleSignOut,
  setMobileOpen,
  t,
}: {
  profileMenuOpen: boolean;
  setProfileMenuOpen: (open: boolean) => void;
  profile: ReturnType<typeof useAuth>["profile"];
  ledCommunities: Awaited<ReturnType<typeof useLedCommunities>["data"]>;
  handleSignOut: () => Promise<void>;
  setMobileOpen: (open: boolean) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-gold">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {profile?.full_name || t("member")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <AppLink to="/portal/dashboard" onClick={() => setMobileOpen(false)}>
            Historia Yangu
          </AppLink>
        </DropdownMenuItem>
        {ledCommunities.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {ledCommunities.map((community) => (
              <DropdownMenuItem key={community.community_id} asChild>
                <AppLink to={`/community/${community.community_id}`} className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">
                    {t("view_as_community_leader")}
                    {ledCommunities.length > 1 ? ` - ${community.community_name}` : ""}
                  </span>
                </AppLink>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> {t("sign_out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PortalLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [desktopExpandedGroups, setDesktopExpandedGroups] = useState<string[]>([]);
  const [lastDesktopActiveGroup, setLastDesktopActiveGroup] = useState<string | null>(null);
  const [mobileExpandedGroups, setMobileExpandedGroups] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, user, userRole } = useAuth();
  const isAdmin = isAdminRole(userRole as AppRole | null);
  const { data: ledCommunities = [] } = useLedCommunities(profileMenuOpen);
  const { memberPortalAccess, isLoading } = useBillingAccess();
  const { getFeatureState, isLoading: featuresLoading } = useFeatureAccess();
  const { t, i18n } = useTranslation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const memberPortalLocked = memberPortalAccess === "none";
  const memberPortalLimited = memberPortalAccess === "limited";
  const useSimpleMemberNav = !isAdmin;
  const notificationFeatureState = getFeatureState("notifications");
  const notificationsVisible = !featuresLoading && notificationFeatureState.exists && notificationFeatureState.visible;
  const memberNotifications = useMemberNotifications(useSimpleMemberNav && notificationsVisible);
  const mainItems = useMemo(
    () => (useSimpleMemberNav ? SIMPLE_MEMBER_MAIN_ITEMS : memberPortalLimited ? LIMITED_MAIN_ITEMS : FULL_MAIN_ITEMS),
    [memberPortalLimited, useSimpleMemberNav],
  );
  const dropdownGroups = useMemo(
    () => (useSimpleMemberNav ? [] : memberPortalLimited ? LIMITED_GROUPS : FULL_GROUPS),
    [memberPortalLimited, useSimpleMemberNav],
  );

  const visibleMainItems = useMemo(
    () => mainItems.filter((item) => !item.featureKey || getFeatureState(item.featureKey).visible),
    [getFeatureState, mainItems],
  );

  const visibleGroups = useMemo(
    () =>
      dropdownGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.featureKey || getFeatureState(item.featureKey).visible),
        }))
        .filter((group) => group.items.length > 0),
    [dropdownGroups, getFeatureState],
  );
  const visibleDesktopSidebarGroups = useMemo(
    () =>
      DESKTOP_SIDEBAR_GROUPS
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.featureKey || getFeatureState(item.featureKey).visible),
        }))
        .filter((group) => group.items.length > 0),
    [getFeatureState],
  );
  const activeDesktopGroup = useMemo(
    () => findDesktopGroupForPath(visibleDesktopSidebarGroups, location.pathname),
    [location.pathname, visibleDesktopSidebarGroups],
  );

  useEffect(() => {
    if (!activeDesktopGroup) {
      setLastDesktopActiveGroup(null);
      return;
    }

    if (activeDesktopGroup === lastDesktopActiveGroup) return;

    setDesktopExpandedGroups((current) =>
      current.includes(activeDesktopGroup) ? current : [...current, activeDesktopGroup],
    );
    setLastDesktopActiveGroup(activeDesktopGroup);
  }, [activeDesktopGroup, lastDesktopActiveGroup]);

  const activeFeatureKey = getPortalFeatureForPath(location.pathname);
  const activeFeatureState = activeFeatureKey ? getFeatureState(activeFeatureKey) : null;
  const simpleMemberRouteHidden =
    useSimpleMemberNav &&
    !isOrdinaryMemberPathAllowed(location.pathname);
  const explicitFeatureUnavailable = (activeFeatureKey === "ministries" || activeFeatureKey === "notifications") && (!activeFeatureState?.exists || !activeFeatureState.visible);
  const routeHidden = !featuresLoading && (simpleMemberRouteHidden || explicitFeatureUnavailable || (activeFeatureKey && !activeFeatureState?.visible));
  const routeLocked = !featuresLoading && activeFeatureState?.locked;

  const toggleMobileGroup = (groupId: string) => {
    setMobileExpandedGroups((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  };

  const toggleDesktopGroup = (groupId: string) => {
    setDesktopExpandedGroups((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  };

  return (
    <ProtectedRoute requireChurch>
      {!isLoading && memberPortalLocked ? (
        <div className="min-h-screen bg-background px-4 py-16">
          <div className="mx-auto max-w-2xl">
            <Card className="glass-card border-primary/20">
              <CardContent className="space-y-5 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold font-serif">{t("unlock_member_portal")}</h1>
                  <p className="text-sm text-muted-foreground">
                    {t("member_portal_unlock_desc", { amount: formatTZS(50000) })}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("member_portal_benefits_desc")}</p>
                </div>
                {isAdmin ? (
                  <Button asChild>
                    <AppLink to="/church-admin/billing">{t("upgrade_to_unlock")}</AppLink>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("ask_admin_unlock_member_portal")}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : routeHidden ? (
        <Navigate to="/portal" replace />
      ) : (
        <div className="flex min-h-screen flex-col bg-background">
          <BibleVersePopup
            userName={profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || t("member")}
            userRole={userRole}
          />

          {isAdmin && (
            <div className="flex items-center justify-between border-b border-primary/20 bg-primary/10 px-4 py-2">
              <span className="text-xs font-medium text-primary">{t("viewing_as_member")}</span>
              <AppLink to="/church-admin" className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <ArrowLeft className="h-3 w-3" /> {t("back_to_admin")}
              </AppLink>
            </div>
          )}

          {memberPortalLimited && (
            <div className="border-b border-primary/20 bg-primary/10 px-4 py-2">
              <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 font-medium text-primary">
                  <Lock className="h-3.5 w-3.5" />
                  {t("limited_member_access")}
                </span>
                {isAdmin && (
                  <Button asChild size="sm" variant="outline" className="h-7 border-primary/30 bg-transparent text-primary hover:bg-primary/10">
                    <AppLink to="/church-admin/billing">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {t("upgrade_to_unlock")}
                    </AppLink>
                  </Button>
                )}
              </div>
            </div>
          )}

          <header className="sticky top-0 z-50 border-b border-border/50 bg-[linear-gradient(180deg,rgba(17,24,39,0.78),rgba(11,15,20,0.86))] backdrop-blur-2xl">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
              <AppLink to="/portal" className="flex items-center gap-3 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-gold shadow-[0_14px_28px_-18px_rgba(250,204,21,0.65)]">
                  <Church className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold font-serif">Kanisa Connect</span>
              </AppLink>

              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-sm font-semibold text-foreground">
                  {profile?.full_name || t("member")}
                </p>
                <p className="truncate text-xs text-muted-foreground">Member Portal</p>
              </div>

              <div className="flex items-center gap-2">
                <LanguageSwitcher className="hidden rounded-2xl border border-border/60 bg-background/40 p-1 md:flex" />

                {useSimpleMemberNav && notificationsVisible ? <MemberNotificationBell notifications={memberNotifications.data ?? []} /> : null}

                <ProfileMenu
                  profileMenuOpen={profileMenuOpen}
                  setProfileMenuOpen={setProfileMenuOpen}
                  profile={profile}
                  ledCommunities={ledCommunities}
                  handleSignOut={handleSignOut}
                  setMobileOpen={setMobileOpen}
                  t={t}
                />

                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen((current) => !current)}>
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {mobileOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-border/50 bg-[linear-gradient(180deg,rgba(17,24,39,0.92),rgba(11,15,20,0.96))] lg:hidden"
                >
                  <nav className="container mx-auto space-y-3 px-4 py-4">
                    <div className="space-y-1.5">
                      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/60">
                        {useSimpleMemberNav ? "Menyu" : "Main"}
                      </p>
                      {visibleMainItems.map((item) => {
                        const state = item.featureKey ? getFeatureState(item.featureKey) : null;
                        const itemLocked = !!state?.locked;
                        const active = isActive(location.pathname, item.url);
                        const Icon = item.icon;

                        return (
                          <AppLink
                            key={item.url}
                            to={item.url}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-all duration-300",
                              "border-white/8 bg-white/[0.03] text-muted-foreground hover:border-primary/15 hover:bg-white/[0.05] hover:text-foreground",
                              active && "border-primary/20 bg-primary/10 text-primary",
                              itemLocked && "text-primary",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                                active
                                  ? "border-primary/20 bg-primary/10 text-primary"
                                  : "border-border/60 bg-background/40 text-muted-foreground",
                              )}
                            >
                              <Icon active={active} className="h-4.5 w-4.5" />
                            </span>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <span className="truncate font-medium">{t(item.titleKey)}</span>
                              {itemLocked ? <Lock className="h-3.5 w-3.5 shrink-0" /> : null}
                            </span>
                          </AppLink>
                        );
                      })}
                    </div>

                    {visibleGroups.length > 0 && (
                    <div className="space-y-2">
                      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/60">
                        Explore
                      </p>
                      {visibleGroups.map((group) => {
                        const groupOpen = mobileExpandedGroups.includes(group.id);
                        const activeWithin = group.items.some((item) => isActive(location.pathname, item.url));

                        return (
                          <div key={group.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-1.5">
                            <button
                              type="button"
                              onClick={() => toggleMobileGroup(group.id)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors",
                                activeWithin ? "bg-primary/10 text-primary" : "text-foreground hover:bg-white/[0.04]",
                              )}
                            >
                              <span className="font-medium">{group.label}</span>
                              <motion.span
                                animate={{ rotate: groupOpen ? 180 : 0 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="text-muted-foreground/80"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </motion.span>
                            </button>

                            <AnimatePresence initial={false}>
                              {groupOpen && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-1.5 px-1 pb-1 pt-1">
                                    {group.items.map((item) => {
                                      const state = item.featureKey ? getFeatureState(item.featureKey) : null;
                                      const itemLocked = !!state?.locked;
                                      const active = isActive(location.pathname, item.url);
                                      const Icon = item.icon;

                                      return (
                                        <AppLink
                                          key={`${group.id}-${item.titleKey}`}
                                          to={item.url}
                                          onClick={() => setMobileOpen(false)}
                                          className={cn(
                                            "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
                                            active
                                              ? "bg-primary/10 text-primary"
                                              : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                                          )}
                                        >
                                          <span
                                            className={cn(
                                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                                              active
                                                ? "border-primary/20 bg-primary/10 text-primary"
                                                : "border-border/60 bg-background/30 text-muted-foreground",
                                            )}
                                          >
                                            <Icon active={active} className="h-4 w-4" />
                                          </span>
                                          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                            <span className="truncate">{t(item.titleKey)}</span>
                                            {itemLocked ? <Lock className="h-3.5 w-3.5 shrink-0" /> : null}
                                          </span>
                                        </AppLink>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                    )}

                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/40 text-primary">
                          <PortalIcon active className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{t("language")}</p>
                          <p className="text-xs text-muted-foreground">
                            {i18n.language === "sw" ? t("swahili") : t("english")}
                          </p>
                        </div>
                      </div>
                      <LanguageSwitcher />
                    </div>
                  </nav>
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          <div className="flex min-w-0 flex-1 lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
            {!isAdmin ? (
              <MemberDesktopSidebar
                groups={visibleDesktopSidebarGroups}
                pathname={location.pathname}
                t={t}
                collapsed={desktopSidebarCollapsed}
                setCollapsed={setDesktopSidebarCollapsed}
                expandedGroups={desktopExpandedGroups}
                toggleGroup={toggleDesktopGroup}
              />
            ) : null}

            <main className="member-main-scrollbar min-w-0 flex-1 lg:h-full lg:overflow-y-auto">
              {routeLocked ? (
                <div className="container mx-auto px-4 py-16">
                  <div className="mx-auto max-w-2xl">
                    <Card className="glass-card border-primary/20">
                      <CardContent className="space-y-5 p-8 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                          <Lock className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-2">
                          <h1 className="text-2xl font-bold font-serif">{t("this_feature_is_locked")}</h1>
                          <p className="text-sm text-muted-foreground">{t("super_admin_locked_feature")}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <>
                  {!isAdmin ? <MemberMobileBackHeader /> : null}
                  <Outlet />
                </>
              )}
            </main>
          </div>

          {!isAdmin && (
            <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 py-2 shadow-[0_-18px_48px_-32px_rgba(0,0,0,0.75)] backdrop-blur-xl lg:hidden">
              <div
                className="mx-auto grid max-w-md gap-1"
                style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
              >
                {visibleMainItems
                  .filter((item) => ["/portal", "/portal/give", "/portal/mass-intentions", "/portal/announcements", "/portal/services"].includes(item.url))
                  .map((item) => {
                  const active = isActive(location.pathname, item.url);
                  const Icon = item.icon;

                  return (
                    <AppLink
                      key={`bottom-${item.url}`}
                      to={item.url}
                      className={cn(
                        "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium transition-colors",
                        active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <Icon active={active} className="h-5 w-5" />
                      <span className="max-w-full truncate">{t(item.titleKey)}</span>
                    </AppLink>
                  );
                })}
              </div>
            </nav>
          )}

          <footer className={cn("mt-12 border-t border-border/50 py-8", !isAdmin && "pb-24 lg:pb-8")}>
            <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md gradient-gold">
                  <Church className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="text-sm font-semibold font-serif">Kanisa Connect</span>
              </div>
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} Kanisa Connect. {t("all_rights_reserved")}
              </p>
            </div>
          </footer>
        </div>
      )}
    </ProtectedRoute>
  );
}
