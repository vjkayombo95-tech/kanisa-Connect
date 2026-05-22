import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  FileText,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { supabase } from "@/integrations/supabase/client";
import type { ChurchAdminFeatureKey } from "@/lib/church-admin-features";
import { cn } from "@/lib/utils";

import { AIAnalyticsSidebarItem } from "./AIAnalyticsSidebarItem";
import { SidebarItem } from "./SidebarItem";
import {
  AnalyticsIcon,
  AnnouncementsIcon,
  AuditIcon,
  BillingIcon,
  BibleIcon,
  ChannelsIcon,
  CommunitiesIcon,
  ContributionsIcon,
  DashboardIcon,
  EventRequestIcon,
  EventsIcon,
  FamiliesIcon,
  ImportIcon,
  MassIntentionsIcon,
  MembersIcon,
  MinistriesIcon,
  NotificationIcon,
  PortalIcon,
  PrayerIcon,
  PledgesIcon,
  ReportsIcon,
  RolesIcon,
  SermonsIcon,
  SettingsIcon,
} from "./sidebar-icons";

type IconComponent = (props: { active?: boolean; className?: string }) => ReactNode;

type NavItem = {
  titleKey: string;
  url: string;
  icon: IconComponent;
  featureKey: ChurchAdminFeatureKey | null;
  ai?: boolean;
};

type AccordionGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  items: NavItem[];
};

const coreItems: NavItem[] = [
  { titleKey: "dashboard", url: "/church-admin", icon: DashboardIcon, featureKey: null },
  { titleKey: "members", url: "/church-admin/members", icon: MembersIcon, featureKey: "members" },
  {
    titleKey: "contributions.title",
    url: "/church-admin/contributions",
    icon: ContributionsIcon,
    featureKey: "contributions",
  },
  {
    titleKey: "AI Analytics",
    url: "/church-admin/analytics-assistant",
    icon: AnalyticsIcon,
    featureKey: "reports",
    ai: true,
  },
];

const groupedSections: AccordionGroup[] = [
  {
    id: "church-management",
    label: "Church Management",
    icon: <Building2 className="h-4 w-4" />,
    items: [
      { titleKey: "pledges", url: "/church-admin/pledges", icon: PledgesIcon, featureKey: "pledges" },
      { titleKey: "ministries", url: "/church-admin/ministries", icon: MinistriesIcon, featureKey: "ministries" },
      { titleKey: "families", url: "/church-admin/families", icon: FamiliesIcon, featureKey: "families" },
      { titleKey: "communities", url: "/church-admin/communities", icon: CommunitiesIcon, featureKey: "communities" },
    ],
  },
  {
    id: "events-services",
    label: "Events & Services",
    icon: <CalendarDays className="h-4 w-4" />,
    items: [
      { titleKey: "events", url: "/church-admin/events", icon: EventsIcon, featureKey: "events" },
      {
        titleKey: "event_requests",
        url: "/church-admin/event-requests",
        icon: EventRequestIcon,
        featureKey: "event_requests",
      },
      {
        titleKey: "mass_intentions",
        url: "/church-admin/mass-intentions",
        icon: MassIntentionsIcon,
        featureKey: "mass_intentions",
      },
      {
        titleKey: "prayer_requests",
        url: "/church-admin/prayer-requests",
        icon: PrayerIcon,
        featureKey: "prayer_requests",
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: <FileText className="h-4 w-4" />,
    items: [
      {
        titleKey: "announcements",
        url: "/church-admin/announcements",
        icon: AnnouncementsIcon,
        featureKey: "announcements",
      },
      { titleKey: "sermons", url: "/church-admin/sermons", icon: SermonsIcon, featureKey: "sermons" },
      { titleKey: "bible_verses", url: "/church-admin/bible-verses", icon: BibleIcon, featureKey: "bible_verses" },
      { titleKey: "channels", url: "/church-admin/channels", icon: ChannelsIcon, featureKey: "channels" },
      {
        titleKey: "notifications",
        url: "/church-admin/notifications",
        icon: NotificationIcon,
        featureKey: "notifications",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: <ShieldCheck className="h-4 w-4" />,
    items: [
      { titleKey: "reports", url: "/church-admin/reports", icon: ReportsIcon, featureKey: "reports" },
      { titleKey: "analytics", url: "/church-admin/analytics", icon: AnalyticsIcon, featureKey: "reports" },
      { titleKey: "data_import", url: "/church-admin/data-import", icon: ImportIcon, featureKey: null },
      { titleKey: "audit_logs", url: "/church-admin/audit-logs", icon: AuditIcon, featureKey: null },
      { titleKey: "billing", url: "/church-admin/billing", icon: BillingIcon, featureKey: null },
      { titleKey: "roles", url: "/church-admin/roles", icon: RolesIcon, featureKey: "roles" },
      { titleKey: "settings", url: "/church-admin/settings", icon: SettingsIcon, featureKey: null },
    ],
  },
];

const workspaceItems: NavItem[] = [
];

const panelTransition = {
  type: "spring",
  stiffness: 220,
  damping: 26,
};

function isItemActive(pathname: string, url: string) {
  return url === "/church-admin" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);
}

function SidebarSectionLabel({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="px-3"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/55">
            {label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AccordionGroupButton({
  label,
  icon,
  open,
  collapsed,
  onClick,
  activeWithin,
}: {
  label: string;
  icon: ReactNode;
  open: boolean;
  collapsed: boolean;
  onClick: () => void;
  activeWithin: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: collapsed ? 1 : 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group flex w-full items-center overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition-colors",
        "border-white/8 bg-white/[0.03] text-muted-foreground hover:border-primary/15 hover:bg-white/[0.045] hover:text-foreground",
        activeWithin && "border-primary/12 bg-primary/[0.06] text-foreground",
        collapsed && "justify-center px-2.5",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors",
          activeWithin
            ? "border-primary/18 bg-primary/10 text-primary"
            : "border-white/8 bg-white/[0.03] text-muted-foreground group-hover:border-primary/10 group-hover:text-foreground",
        )}
      >
        {icon}
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10, width: 0 }}
            animate={{ opacity: 1, x: 0, width: "auto" }}
            exit={{ opacity: 0, x: -8, width: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="ml-3 flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden"
          >
            <span className="truncate text-sm font-medium tracking-[0.01em]">{label}</span>
            <motion.div
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0 text-muted-foreground/80"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function ChurchAdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { churchId } = useAuth();
  const { getFeatureState } = useFeatureAccess();
  const { t, i18n } = useTranslation();

  const { data: church } = useQuery({
    queryKey: ["sidebar-church", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data } = await supabase.from("churches").select("name, code, logo_url").eq("id", churchId).maybeSingle();
      return data;
    },
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
  });

  const visibleCoreItems = useMemo(
    () => coreItems.filter((item) => !item.featureKey || getFeatureState(item.featureKey).visible),
    [getFeatureState],
  );

  const visibleGroupedSections = useMemo(
    () =>
      groupedSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => !item.featureKey || getFeatureState(item.featureKey).visible),
        }))
        .filter((section) => section.items.length > 0),
    [getFeatureState],
  );

  const visibleWorkspaceItems = useMemo(
    () => workspaceItems.filter((item) => !item.featureKey || getFeatureState(item.featureKey).visible),
    [getFeatureState],
  );

  const activeGroupIds = useMemo(
    () =>
      visibleGroupedSections
        .filter((section) => section.items.some((item) => isItemActive(location.pathname, item.url)))
        .map((section) => section.id),
    [location.pathname, visibleGroupedSections],
  );

  const [openGroups, setOpenGroups] = useState<string[]>(() => activeGroupIds.slice(0, 2));

  useEffect(() => {
    if (collapsed) return;

    setOpenGroups((current) => {
      const merged = [...activeGroupIds, ...current.filter((id) => !activeGroupIds.includes(id))].slice(0, 2);
      return merged;
    });
  }, [activeGroupIds, collapsed]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => {
      if (current.includes(groupId)) {
        return current.filter((id) => id !== groupId);
      }

      return [groupId, ...current].slice(0, 2);
    });
  };

  const renderNavItem = (item: NavItem, delay: number) => {
    const featureState = item.featureKey ? getFeatureState(item.featureKey) : null;
    const active = isItemActive(location.pathname, item.url);
    const Icon = item.icon;

    if (item.ai) {
      return (
        <AIAnalyticsSidebarItem
          key={item.url}
          href={item.url}
          label={t(item.titleKey)}
          active={active}
          collapsed={collapsed}
          delay={delay}
        />
      );
    }

    return (
      <SidebarItem
        key={item.url}
        href={item.url}
        icon={<Icon active={active} className="h-5 w-5" />}
        label={t(item.titleKey)}
        active={active}
        collapsed={collapsed}
        locked={!!featureState?.locked}
        delay={delay}
      />
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "border-r border-white/6 bg-[#0b0f14]/92 p-3 text-sidebar-foreground backdrop-blur-2xl",
        "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_28%)] before:content-['']",
      )}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_80px_-42px_rgba(0,0,0,0.88)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_24%,transparent_76%,rgba(250,204,21,0.05))]" />

        <motion.div
          layout
          transition={panelTransition}
          className="relative z-10 flex items-center gap-3 border-b border-white/8 px-3 py-4"
        >
          <motion.div
            layout
            transition={panelTransition}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-primary/20 bg-[linear-gradient(145deg,rgba(250,204,21,0.24),rgba(250,204,21,0.08))] shadow-[0_18px_34px_-24px_rgba(250,204,21,0.55)]"
          >
            {church?.logo_url ? (
              <img src={church.logo_url} alt={`${church?.name || "Church"} logo`} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary">
                <DashboardIcon active className="h-5 w-5" />
              </div>
            )}
          </motion.div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="min-w-0"
              >
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
                  Church OS
                </p>
                <h2 className="truncate text-sm font-semibold text-foreground">{church?.name || "Kanisa Connect"}</h2>
                <p className="truncate text-xs text-muted-foreground">{church?.code || "Premium Workspace"}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <SidebarContent className="premium-scrollbar relative z-10 flex-1 overflow-y-auto px-2 py-3 pr-1 scrollbar-gutter-stable">
          <div className="space-y-5">
            <section className="space-y-2">
              <SidebarSectionLabel label="Core" collapsed={collapsed} />
              <div className="space-y-1.5">
                {visibleCoreItems.map((item, index) => renderNavItem(item, index * 0.04))}
              </div>
            </section>

            <section className="space-y-2">
              <SidebarSectionLabel label="Grouped Navigation" collapsed={collapsed} />
              <div className="space-y-2">
                {visibleGroupedSections.map((section, sectionIndex) => {
                  const open = openGroups.includes(section.id) && !collapsed;
                  const activeWithin = section.items.some((item) => isItemActive(location.pathname, item.url));

                  return (
                    <div key={section.id} className="space-y-1.5">
                      <AccordionGroupButton
                        label={section.label}
                        icon={section.icon}
                        open={open}
                        collapsed={collapsed}
                        activeWithin={activeWithin}
                        onClick={() => toggleGroup(section.id)}
                      />

                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1.5 border-l border-white/8 pl-3">
                              {section.items.map((item, itemIndex) =>
                                renderNavItem(item, 0.08 + sectionIndex * 0.04 + itemIndex * 0.03),
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <SidebarSectionLabel label="Workspace" collapsed={collapsed} />
              <div className="space-y-1.5">
                {visibleWorkspaceItems.map((item, index) => renderNavItem(item, 0.12 + index * 0.03))}
              </div>
            </section>
          </div>

          <div className="relative mt-5 border-t border-white/8 px-0 pb-3 pt-3">
            <div className="grid gap-1.5">
              <SidebarItem
                href="/portal"
                icon={<PortalIcon active={isItemActive(location.pathname, "/portal")} className="h-5 w-5" />}
                label={t("view_as_member")}
                active={isItemActive(location.pathname, "/portal")}
                collapsed={collapsed}
                delay={0.22}
              />

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.26, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-2",
                  collapsed && "justify-center",
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-muted-foreground">
                  <Bell className="h-4 w-4" />
                </div>
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -10, width: 0 }}
                      animate={{ opacity: 1, x: 0, width: "auto" }}
                      exit={{ opacity: 0, x: -8, width: 0 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{t("language_switcher.label")}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {i18n.language === "sw" ? t("language_switcher.swahili") : t("language_switcher.english")}
                        </p>
                      </div>
                      <LanguageSwitcher buttonClassName="border border-white/8 bg-white/[0.04]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-3 rounded-2xl border border-primary/15 bg-[linear-gradient(135deg,rgba(250,204,21,0.12),rgba(250,204,21,0.04)_55%,rgba(255,255,255,0.03))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Premium Control</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Grouped navigation keeps the workspace faster to scan while preserving your full admin toolkit.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SidebarContent>
      </div>
    </Sidebar>
  );
}
