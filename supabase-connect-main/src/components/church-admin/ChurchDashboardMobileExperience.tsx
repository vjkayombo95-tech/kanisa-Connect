import { CalendarClock, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  ChurchDashboardIntelligenceView,
  type ChurchDashboardIntelligenceState,
} from "@/components/church-admin/ChurchDashboardIntelligence";
import { useVisibleStaffServices } from "@/components/staff-mobile/StaffMobileExperience";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_PENDING_COUNTS, visiblePendingActions } from "@/lib/church-dashboard-intelligence";
import { translateStaffServiceLabel, translateStaffWorkspaceLabel, translateSystemLabel } from "@/lib/localization";
import type { StaffMobileConfig, StaffService } from "@/lib/staff-mobile-registry";
import { cn } from "@/lib/utils";

type AttendanceSummary = {
  title: string | null;
  yes: number;
  maybe: number;
  responseRate: number;
};

type ChurchDashboardMobileExperienceProps = {
  config: StaffMobileConfig;
  intelligence: ChurchDashboardIntelligenceState;
  administratorName: string;
  greeting: string;
  churchName: string | null;
  bannerUrl: string | null;
  bannerPositionY: number;
  activeMembers: number;
  totalMembers: number;
  announcementCount: number;
  upcomingEventCount: number;
  attendance: AttendanceSummary;
  criticalLoading: boolean;
  criticalError: boolean;
  deferredLoading: boolean;
  deferredError: boolean;
};

const pendingServiceId: Record<string, string> = {
  events: "events",
  massIntentions: "mass-intentions",
  prayerRequests: "prayer-requests",
  communityHelp: "community-help",
  invitations: "roles",
  announcements: "announcements",
  payments: "qr-payments",
  memberships: "communities",
  volunteers: "ministries",
};

function MobileServiceCard({ service }: { service: StaffService }) {
  const { t } = useTranslation();
  const Icon = service.icon;
  return (
    <Link to={service.route} className="flex min-h-24 items-center gap-3 rounded-xl border border-border/70 bg-card/85 p-4 outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="text-sm font-semibold text-foreground">{translateStaffServiceLabel(t, service)}</span>
    </Link>
  );
}

export function ChurchDashboardMobileExperience({
  config,
  intelligence,
  administratorName,
  greeting,
  churchName,
  bannerUrl,
  bannerPositionY,
  activeMembers,
  totalMembers,
  announcementCount,
  upcomingEventCount,
  attendance,
  criticalLoading,
  criticalError,
  deferredLoading,
  deferredError,
}: ChurchDashboardMobileExperienceProps) {
  const { t } = useTranslation();
  const { services, isLoading: servicesLoading } = useVisibleStaffServices(config);
  const visibleServiceIds = new Set(services.map((service) => service.id));
  const priorities = visiblePendingActions(intelligence.pending.data ?? EMPTY_PENDING_COUNTS, intelligence.staffWorkspace)
    .filter((item) => visibleServiceIds.has(pendingServiceId[item.key]))
    .slice(0, 3);
  const quickActions = services.filter((service) => service.primary).slice(0, 4);
  const pendingTotal = priorities.reduce((sum, item) => sum + item.count, 0);
  const coverPositionY = Number.isFinite(bannerPositionY)
    ? Math.max(0, Math.min(100, Math.round(bannerPositionY)))
    : 38;

  // Focus order is deliberately stable: authorized pending work, next Mass,
  // upcoming events, recent announcements, then the calm state.
  const focusLoading = !priorities.length && (intelligence.pending.isLoading || criticalLoading || deferredLoading || servicesLoading);
  const focus = priorities.length && !intelligence.pending.isError
    ? t("church_admin_dashboard.mobile.focus.priority", {
      count: priorities[0].count,
      label: translateSystemLabel(t, priorities[0].labelKey, priorities[0].label).toLocaleLowerCase(),
    })
    : !deferredError && attendance.title
      ? t("church_admin_dashboard.mobile.focus.mass", { title: attendance.title, yes: attendance.yes, maybe: attendance.maybe })
      : !deferredError && upcomingEventCount
        ? t("church_admin_dashboard.mobile.focus.events", { count: upcomingEventCount })
        : !criticalError && announcementCount
          ? t("church_admin_dashboard.mobile.focus.announcements", { count: announcementCount })
          : intelligence.pending.isError || criticalError || deferredError
            ? t("church_admin_dashboard.mobile.focus.unavailable")
            : t("church_admin_dashboard.mobile.focus.clear");

  const briefing = [
    { key: "members", loading: criticalLoading, value: criticalError ? t("church_admin_dashboard.mobile.briefing.members_unavailable") : t("church_admin_dashboard.mobile.briefing.members", { active: activeMembers, total: totalMembers }) },
    { key: "pending", loading: intelligence.pending.isLoading || servicesLoading, value: intelligence.pending.isError ? t("church_admin_dashboard.mobile.briefing.pending_unavailable") : pendingTotal ? t("church_admin_dashboard.mobile.briefing.pending", { count: pendingTotal }) : t("church_admin_dashboard.mobile.briefing.pending_clear") },
    { key: "schedule", loading: deferredLoading, value: deferredError ? t("church_admin_dashboard.mobile.briefing.schedule_unavailable") : attendance.title ? t("church_admin_dashboard.mobile.briefing.mass", { title: attendance.title, yes: attendance.yes }) : !criticalError ? t("church_admin_dashboard.mobile.briefing.schedule", { announcements: announcementCount, events: upcomingEventCount }) : t("church_admin_dashboard.mobile.briefing.events", { count: upcomingEventCount }) },
  ];
  const snapshot = [
    { label: t("church_admin_dashboard.mobile.snapshot.active_members"), value: criticalError ? "-" : String(activeMembers), loading: criticalLoading },
    { label: t("church_admin_dashboard.mobile.snapshot.announcements"), value: criticalError ? "-" : String(announcementCount), loading: criticalLoading },
    { label: t("church_admin_dashboard.mobile.snapshot.upcoming_events"), value: deferredError ? "-" : String(upcomingEventCount), loading: deferredLoading },
    { label: !deferredError && attendance.title ? t("church_admin_dashboard.mobile.snapshot.mass_confirmed") : t("church_admin_dashboard.mobile.snapshot.next_mass"), value: deferredError ? "-" : attendance.title ? String(attendance.yes) : "-", loading: deferredLoading },
  ];

  return (
    <div className="space-y-7 lg:hidden" data-testid="church-dashboard-mobile-parity-core">
      <section
        className={cn(
          "relative grid gap-4 overflow-hidden rounded-2xl border border-primary/20 p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.75fr)]",
          bannerUrl ? "bg-cover text-white" : "bg-card/85",
        )}
        style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")`, backgroundPosition: `center ${coverPositionY}%` } : undefined}
        aria-label={t("church_admin_dashboard.mobile.hero_aria_label")}
      >
        {bannerUrl ? <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25" aria-hidden="true" /> : null}
        <div className={cn("relative z-10 flex items-start gap-3", bannerUrl && "[&_.text-muted-foreground]:text-white/80 [&_.text-primary]:text-white/80")}>
          <span className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            bannerUrl ? "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm" : "bg-primary/10 text-primary",
          )}><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Kanisa Connect</p><h1 className="mt-2 font-serif text-2xl font-bold">{greeting}, {administratorName.split(" ")[0]}.</h1><p className="mt-1 text-sm text-muted-foreground">{churchName || t("staff_mobile.your_parish")} - {translateStaffWorkspaceLabel(t, config.workspace)}</p></div>
        </div>
        <div className={cn("relative z-10 rounded-xl border p-4", bannerUrl ? "border-white/20 bg-black/35 text-white backdrop-blur-sm [&_.text-foreground\\/80]:text-white/85 [&_.text-primary]:text-white/80" : "border-border/70 bg-background/50")} data-testid="mobile-todays-focus"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><CalendarClock className="h-4 w-4" aria-hidden="true" />{t("church_admin_dashboard.mobile.focus.title")}</p>{focusLoading ? <Skeleton className="mt-3 h-5 w-4/5" /> : <p className="mt-2 text-sm leading-6 text-foreground/80">{focus}</p>}</div>
      </section>

      <section className="space-y-3" aria-labelledby="mobile-priorities"><div><h2 id="mobile-priorities" className="font-serif text-lg font-semibold">{t("church_admin_dashboard.mobile.priorities.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("church_admin_dashboard.mobile.priorities.description")}</p></div>
        {intelligence.pending.isLoading || servicesLoading ? <Skeleton className="h-28 rounded-xl" /> : intelligence.pending.isError ? <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{t("church_admin_dashboard.mobile.priorities.error")}</p> : priorities.length ? <div className="grid gap-3 min-[430px]:grid-cols-2 md:grid-cols-3">{priorities.map((item) => <Link key={item.key} to={item.route} className="flex min-h-24 items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/85 p-4"><span><span className="text-sm font-semibold">{translateSystemLabel(t, item.labelKey, item.label)}</span><span className="mt-1 block text-xs text-muted-foreground">{t("church_admin_dashboard.mobile.priorities.waiting", { count: item.count })}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /></Link>)}</div> : <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" /><div><p className="text-sm font-semibold">{t("church_admin_dashboard.mobile.priorities.clear_title")}</p><p className="text-xs text-muted-foreground">{t("church_admin_dashboard.mobile.priorities.clear_description")}</p></div></div>}
      </section>

      <section className="space-y-3" aria-labelledby="mobile-quick-actions"><div><h2 id="mobile-quick-actions" className="font-serif text-lg font-semibold">{t("church_admin_dashboard.quick_actions.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("church_admin_dashboard.mobile.quick_actions.description")}</p></div>{servicesLoading ? <Skeleton className="h-48 rounded-xl" /> : quickActions.length ? <div className="grid grid-cols-2 gap-3" data-testid="mobile-dashboard-quick-actions">{quickActions.map((service) => <MobileServiceCard key={service.id} service={service} />)}</div> : <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{t("church_admin_dashboard.mobile.quick_actions.empty")}</p>}</section>

      <div className="grid gap-7 md:grid-cols-2">
        <section className="space-y-3" aria-labelledby="mobile-briefing"><div><h2 id="mobile-briefing" className="font-serif text-lg font-semibold">{t("church_admin_dashboard.mobile.briefing.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("church_admin_dashboard.mobile.briefing.description")}</p></div><div className="space-y-2 rounded-xl border border-border/70 bg-card/85 p-4">{briefing.map((row) => <p key={row.key} className="border-b border-border/60 pb-2 text-sm leading-6 last:border-0 last:pb-0">{row.loading ? <Skeleton className="h-5 w-4/5" /> : row.value}</p>)}</div></section>
        <section className="space-y-3" aria-labelledby="mobile-snapshot"><div><h2 id="mobile-snapshot" className="font-serif text-lg font-semibold">{t("church_admin_dashboard.mobile.snapshot.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("church_admin_dashboard.mobile.snapshot.description")}</p></div><div className="grid grid-cols-2 gap-3">{snapshot.map((item) => <div key={item.label} className="rounded-xl border border-border/70 bg-card/85 p-3"><p className="text-xs text-muted-foreground">{item.label}</p>{item.loading ? <Skeleton className="mt-2 h-7 w-12" /> : <p className="mt-1 text-xl font-semibold">{item.value}</p>}</div>)}</div></section>
      </div>

      <section className="space-y-3" aria-labelledby="mobile-release-b"><div><h2 id="mobile-release-b" className="font-serif text-lg font-semibold">{t("church_admin_dashboard.mobile.release_b.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("church_admin_dashboard.mobile.release_b.description")}</p></div><ChurchDashboardIntelligenceView intelligence={intelligence} compact /></section>

      <Link to={config.servicesRoute} className="flex min-h-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.06] text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("staff_mobile.all_services")} -&gt;</Link>
    </div>
  );
}
