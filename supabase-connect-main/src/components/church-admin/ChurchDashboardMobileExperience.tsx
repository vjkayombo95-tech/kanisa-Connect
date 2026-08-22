import { CalendarClock, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import {
  ChurchDashboardIntelligenceView,
  type ChurchDashboardIntelligenceState,
} from "@/components/church-admin/ChurchDashboardIntelligence";
import { useVisibleStaffServices } from "@/components/staff-mobile/StaffMobileExperience";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_PENDING_COUNTS, visiblePendingActions } from "@/lib/church-dashboard-intelligence";
import type { StaffMobileConfig, StaffService } from "@/lib/staff-mobile-registry";
import { roleLabel } from "@/lib/staff-mobile-role";

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
  const Icon = service.icon;
  return (
    <Link to={service.route} className="flex min-h-24 items-center gap-3 rounded-xl border border-border/70 bg-card/85 p-4 outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="text-sm font-semibold text-foreground">{service.label}</span>
    </Link>
  );
}

export function ChurchDashboardMobileExperience({
  config,
  intelligence,
  administratorName,
  greeting,
  churchName,
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
  const { services, isLoading: servicesLoading } = useVisibleStaffServices(config);
  const visibleServiceIds = new Set(services.map((service) => service.id));
  const priorities = visiblePendingActions(intelligence.pending.data ?? EMPTY_PENDING_COUNTS, intelligence.staffWorkspace)
    .filter((item) => visibleServiceIds.has(pendingServiceId[item.key]))
    .slice(0, 3);
  const quickActions = services.filter((service) => service.primary).slice(0, 4);
  const pendingTotal = priorities.reduce((sum, item) => sum + item.count, 0);

  // Focus order is deliberately stable: authorized pending work, next Mass,
  // upcoming events, recent announcements, then the calm state.
  const focusLoading = !priorities.length && (intelligence.pending.isLoading || criticalLoading || deferredLoading || servicesLoading);
  const focus = priorities.length && !intelligence.pending.isError
    ? `${priorities[0].count} ${priorities[0].label.toLocaleLowerCase()} need attention.`
    : !deferredError && attendance.title
      ? `${attendance.title}: ${attendance.yes} confirmed and ${attendance.maybe} maybe.`
      : !deferredError && upcomingEventCount
        ? `${upcomingEventCount} upcoming event${upcomingEventCount === 1 ? "" : "s"} to prepare for.`
        : !criticalError && announcementCount
          ? `${announcementCount} recent announcement${announcementCount === 1 ? "" : "s"} published.`
          : intelligence.pending.isError || criticalError || deferredError
            ? "Some of today's dashboard information is temporarily unavailable."
            : "No urgent dashboard work needs attention.";

  const briefing = [
    { key: "members", loading: criticalLoading, value: criticalError ? "Member activity is temporarily unavailable." : `${activeMembers} active of ${totalMembers} registered members` },
    { key: "pending", loading: intelligence.pending.isLoading || servicesLoading, value: intelligence.pending.isError ? "Pending work status is temporarily unavailable." : pendingTotal ? `${pendingTotal} authorized pending item${pendingTotal === 1 ? "" : "s"}` : "Authorized work queues are clear" },
    { key: "schedule", loading: deferredLoading, value: deferredError ? "Mass and event information is temporarily unavailable." : attendance.title ? `${attendance.title}: ${attendance.yes} confirmed` : !criticalError ? `${announcementCount} announcements · ${upcomingEventCount} upcoming events` : `${upcomingEventCount} upcoming events` },
  ];
  const snapshot = [
    { label: "Active members", value: criticalError ? "—" : String(activeMembers), loading: criticalLoading },
    { label: "Announcements", value: criticalError ? "—" : String(announcementCount), loading: criticalLoading },
    { label: "Upcoming events", value: deferredError ? "—" : String(upcomingEventCount), loading: deferredLoading },
    { label: !deferredError && attendance.title ? "Mass confirmed" : "Next Mass", value: deferredError ? "—" : attendance.title ? String(attendance.yes) : "—", loading: deferredLoading },
  ];

  return (
    <div className="space-y-7 lg:hidden" data-testid="church-dashboard-mobile-parity-core">
      <section className="grid gap-4 rounded-2xl border border-primary/20 bg-card/85 p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.75fr)]" aria-label="Mobile workspace briefing">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Kanisa Connect</p><h1 className="mt-2 font-serif text-2xl font-bold">{greeting}, {administratorName.split(" ")[0]}.</h1><p className="mt-1 text-sm text-muted-foreground">{churchName || "Your parish"} · {config.workspace === "community" ? "Uongozi wa jumuiya" : roleLabel(config.workspace)}</p></div>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/50 p-4" data-testid="mobile-todays-focus"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><CalendarClock className="h-4 w-4" />Today&apos;s Focus</p>{focusLoading ? <Skeleton className="mt-3 h-5 w-4/5" /> : <p className="mt-2 text-sm leading-6 text-foreground/80">{focus}</p>}</div>
      </section>

      <section className="space-y-3" aria-labelledby="mobile-priorities"><div><h2 id="mobile-priorities" className="font-serif text-lg font-semibold">Today&apos;s Priorities</h2><p className="mt-1 text-sm text-muted-foreground">Your highest-value authorized work queues.</p></div>
        {intelligence.pending.isLoading || servicesLoading ? <Skeleton className="h-28 rounded-xl" /> : intelligence.pending.isError ? <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Priorities are temporarily unavailable. Access remains restricted.</p> : priorities.length ? <div className="grid gap-3 min-[430px]:grid-cols-2 md:grid-cols-3">{priorities.map((item) => <Link key={item.key} to={item.route} className="flex min-h-24 items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/85 p-4"><span><span className="text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.count} waiting</span></span><ChevronRight className="h-4 w-4 shrink-0 text-primary" /></Link>)}</div> : <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-success" /><div><p className="text-sm font-semibold">No priorities need attention</p><p className="text-xs text-muted-foreground">Your authorized work queues are clear.</p></div></div>}
      </section>

      <section className="space-y-3" aria-labelledby="mobile-quick-actions"><div><h2 id="mobile-quick-actions" className="font-serif text-lg font-semibold">Quick Actions</h2><p className="mt-1 text-sm text-muted-foreground">Role-aware production services.</p></div>{servicesLoading ? <Skeleton className="h-48 rounded-xl" /> : quickActions.length ? <div className="grid grid-cols-2 gap-3" data-testid="mobile-dashboard-quick-actions">{quickActions.map((service) => <MobileServiceCard key={service.id} service={service} />)}</div> : <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No authorized primary actions are available.</p>}</section>

      <div className="grid gap-7 md:grid-cols-2">
        <section className="space-y-3" aria-labelledby="mobile-briefing"><div><h2 id="mobile-briefing" className="font-serif text-lg font-semibold">Assistant Daily Briefing</h2><p className="mt-1 text-sm text-muted-foreground">Current production signals, summarized deterministically.</p></div><div className="space-y-2 rounded-xl border border-border/70 bg-card/85 p-4">{briefing.map((row) => <p key={row.key} className="border-b border-border/60 pb-2 text-sm leading-6 last:border-0 last:pb-0">{row.loading ? <Skeleton className="h-5 w-4/5" /> : row.value}</p>)}</div></section>
        <section className="space-y-3" aria-labelledby="mobile-snapshot"><div><h2 id="mobile-snapshot" className="font-serif text-lg font-semibold">Operational Snapshot</h2><p className="mt-1 text-sm text-muted-foreground">Compact parish metrics.</p></div><div className="grid grid-cols-2 gap-3">{snapshot.map((item) => <div key={item.label} className="rounded-xl border border-border/70 bg-card/85 p-3"><p className="text-xs text-muted-foreground">{item.label}</p>{item.loading ? <Skeleton className="mt-2 h-7 w-12" /> : <p className="mt-1 text-xl font-semibold">{item.value}</p>}</div>)}</div></section>
      </div>

      <section className="space-y-3" aria-labelledby="mobile-release-b"><div><h2 id="mobile-release-b" className="font-serif text-lg font-semibold">Pending Work + Financial Summary</h2><p className="mt-1 text-sm text-muted-foreground">Existing Release B authorization and data contracts.</p></div><ChurchDashboardIntelligenceView intelligence={intelligence} compact /></section>

      <Link to={config.servicesRoute} className="flex min-h-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.06] text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">Huduma zote →</Link>
    </div>
  );
}
