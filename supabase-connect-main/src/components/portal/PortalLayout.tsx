import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building2,
  Church,
  Lock,
  LogOut,
  Menu,
  Sparkles,
  User,
  X,
  ChevronDown,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
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
import { formatTZS } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { getPortalFeatureForPath, type PortalFeatureKey } from "@/lib/portal-features";
import { AppLink } from "@/components/AppLink";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
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
  { titleKey: "Nyumbani", url: "/portal", icon: DashboardIcon, featureKey: null },
  { titleKey: "Lipa", url: "/portal/give", icon: ContributionsIcon, featureKey: "give" },
  { titleKey: "Misa/Sala", url: "/portal/prayer-requests", icon: PrayerIcon, featureKey: "prayer_requests" },
  { titleKey: "Matangazo", url: "/portal/announcements", icon: AnnouncementsIcon, featureKey: "announcements" },
  { titleKey: "Wasifu", url: "/portal/dashboard", icon: PortalIcon, featureKey: null },
];

const SIMPLE_MEMBER_ALLOWED_PATHS = [
  "/portal",
  "/portal/dashboard",
  "/portal/give",
  "/portal/prayer-requests",
  "/portal/mass-intentions",
  "/portal/announcements",
];

const LIMITED_MAIN_ITEMS: NavItem[] = [
  { titleKey: "home", url: "/portal", icon: DashboardIcon, featureKey: null },
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

function isActive(pathname: string, url: string) {
  return url === "/portal" ? pathname === "/portal" : pathname.startsWith(url);
}

function DesktopNavLink({
  item,
  pathname,
  getFeatureState,
  t,
}: {
  item: NavItem;
  pathname: string;
  getFeatureState: ReturnType<typeof useFeatureAccess>["getFeatureState"];
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const state = item.featureKey ? getFeatureState(item.featureKey) : null;
  const itemLocked = !!state?.locked;
  const active = isActive(pathname, item.url);
  const Icon = item.icon;

  return (
    <AppLink
      to={item.url}
      className={cn(
        "group relative overflow-hidden rounded-2xl border px-3 py-2 text-sm transition-all duration-300",
        "border-white/8 bg-white/[0.03] text-muted-foreground hover:border-primary/20 hover:bg-white/[0.05] hover:text-foreground",
        active && "border-primary/20 bg-primary/10 text-primary shadow-[0_18px_36px_-28px_rgba(250,204,21,0.55)]",
        itemLocked && "border-primary/20 bg-primary/5 text-primary",
      )}
    >
      <span className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.05),transparent_38%,rgba(250,204,21,0.08))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="relative flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition-all",
            active
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border/60 bg-background/40 text-muted-foreground group-hover:border-primary/10 group-hover:text-foreground",
          )}
        >
          <Icon active={active} className="h-4.5 w-4.5" />
        </span>
        <span className="font-medium">{t(item.titleKey)}</span>
        {itemLocked ? <Lock className="h-3.5 w-3.5" /> : null}
      </span>
    </AppLink>
  );
}

function DesktopGroup({
  group,
  pathname,
  getFeatureState,
  t,
  openGroup,
  setOpenGroup,
}: {
  group: NavGroup;
  pathname: string;
  getFeatureState: ReturnType<typeof useFeatureAccess>["getFeatureState"];
  t: ReturnType<typeof useTranslation>["t"];
  openGroup: string | null;
  setOpenGroup: (groupId: string | null) => void;
}) {
  const activeWithin = group.items.some((item) => isActive(pathname, item.url));
  const isOpen = openGroup === group.id;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpenGroup(group.id)}
      onMouseLeave={() => setOpenGroup(null)}
    >
      <button
        type="button"
        onClick={() => setOpenGroup(isOpen ? null : group.id)}
        className={cn(
          "group relative flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-all duration-300",
          "border-white/8 bg-white/[0.03] text-muted-foreground hover:border-primary/20 hover:bg-white/[0.05] hover:text-foreground",
          activeWithin && "border-primary/20 bg-primary/10 text-primary",
        )}
      >
        <span className="font-medium">{group.label}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="text-muted-foreground/80 group-hover:text-primary"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-[calc(100%+12px)] z-50 w-72"
          >
            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.86),rgba(11,15,20,0.94))] p-2 shadow-[0_28px_80px_-34px_rgba(0,0,0,0.88)] backdrop-blur-2xl">
              <div className="rounded-[20px] border border-white/8 bg-white/[0.025] p-2">
                <div className="px-2 pb-2 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary/75">
                    {group.label}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const state = item.featureKey ? getFeatureState(item.featureKey) : null;
                    const itemLocked = !!state?.locked;
                    const active = isActive(pathname, item.url);
                    const Icon = item.icon;

                    return (
                      <AppLink
                        key={`${group.id}-${item.titleKey}`}
                        to={item.url}
                        className={cn(
                          "group/item flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-all duration-300",
                          "border-transparent text-muted-foreground hover:border-primary/15 hover:bg-primary/8 hover:text-foreground",
                          active && "border-primary/18 bg-primary/10 text-primary",
                          itemLocked && "text-primary",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors",
                            active
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-border/50 bg-background/30 text-muted-foreground group-hover/item:border-primary/12 group-hover/item:text-foreground",
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PortalLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileExpandedGroups, setMobileExpandedGroups] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, user, userRole } = useAuth();
  const isAdmin = isAdminRole(userRole as AppRole | null);
  const { data: ledCommunities = [] } = useLedCommunities();
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
  const mainItems = useSimpleMemberNav ? SIMPLE_MEMBER_MAIN_ITEMS : memberPortalLimited ? LIMITED_MAIN_ITEMS : FULL_MAIN_ITEMS;
  const dropdownGroups = useSimpleMemberNav ? [] : memberPortalLimited ? LIMITED_GROUPS : FULL_GROUPS;

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

  const activeFeatureKey = getPortalFeatureForPath(location.pathname);
  const activeFeatureState = activeFeatureKey ? getFeatureState(activeFeatureKey) : null;
  const simpleMemberRouteHidden =
    useSimpleMemberNav &&
    !SIMPLE_MEMBER_ALLOWED_PATHS.some((path) => (path === "/portal" ? location.pathname === path : location.pathname.startsWith(path)));
  const routeHidden = !featuresLoading && (simpleMemberRouteHidden || (activeFeatureKey && !activeFeatureState?.visible));
  const routeLocked = !featuresLoading && activeFeatureState?.locked;

  const toggleMobileGroup = (groupId: string) => {
    setMobileExpandedGroups((current) =>
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
              <AppLink to="/portal" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-gold shadow-[0_14px_28px_-18px_rgba(250,204,21,0.65)]">
                  <Church className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold font-serif">Kanisa Connect</span>
              </AppLink>

              <nav className="hidden items-center gap-2 lg:flex">
                {visibleMainItems.map((item) => (
                  <DesktopNavLink
                    key={item.url}
                    item={item}
                    pathname={location.pathname}
                    getFeatureState={getFeatureState}
                    t={t}
                  />
                ))}

                {visibleGroups.map((group) => (
                  <DesktopGroup
                    key={group.id}
                    group={group}
                    pathname={location.pathname}
                    getFeatureState={getFeatureState}
                    t={t}
                    openGroup={openGroup}
                    setOpenGroup={setOpenGroup}
                  />
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <LanguageSwitcher className="hidden rounded-2xl border border-border/60 bg-background/40 p-1 md:flex" />

                <DropdownMenu>
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
                    <DropdownMenuItem
                      onClick={() => {
                        setMobileOpen(false);
                        window.location.assign("/portal/dashboard");
                      }}
                    >
                      {useSimpleMemberNav ? "Historia Yangu" : t("my_dashboard")}
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

          <main className="flex-1">
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
              <Outlet />
            )}
          </main>

          {!isAdmin && (
            <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 py-2 shadow-[0_-18px_48px_-32px_rgba(0,0,0,0.75)] backdrop-blur-xl lg:hidden">
              <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
                {visibleMainItems.map((item) => {
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
