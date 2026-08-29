import { CalendarClock, CheckCircle2, ChevronRight, Clock3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { ChurchDashboardIntelligenceView } from "@/components/church-admin/ChurchDashboardIntelligence";
import { ChurchAdminLiveMediaAwareness } from "@/components/church-admin/ChurchAdminLiveMediaAwareness";
import { useVisibleStaffServices } from "@/components/staff-mobile/StaffMobileExperience";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChurchDashboardIntelligenceState } from "@/components/church-admin/ChurchDashboardIntelligence";
import { EMPTY_FINANCIAL_SUMMARY, EMPTY_PENDING_COUNTS, visiblePendingActions } from "@/lib/church-dashboard-intelligence";
import { formatTZS } from "@/lib/currency";
import { getStaffMobileConfig, type StaffMobileConfig } from "@/lib/staff-mobile-registry";

type AttendanceSummary = {
  title: string | null;
  yes: number;
  maybe: number;
  responseRate: number;
};

export type ChurchDashboardActivityItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
};

type ChurchDashboardExperienceProps = {
  intelligence: ChurchDashboardIntelligenceState;
  administratorName: string;
  greeting: string;
  churchName: string | null;
  activeMembers: number;
  totalMembers: number;
  announcementCount: number;
  upcomingEventCount: number;
  attendance: AttendanceSummary;
  recentActivity: ChurchDashboardActivityItem[];
  criticalLoading: boolean;
  deferredLoading: boolean;
};

const quickActionIds = new Set(["members", "contributions", "announcements", "mass-intentions", "events"]);

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div>
      <h2 id={id} className="font-serif text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function VisibleChurchDashboardQuickActions({ config }: { config: StaffMobileConfig }) {
  const { services } = useVisibleStaffServices(config);
  const quickActions = services.filter((service) => quickActionIds.has(service.id));

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="church-dashboard-quick-actions">
      {quickActions.map((service) => { const Icon = service.icon; return (
        <Link key={service.id} to={service.route} className="flex min-h-20 items-center gap-3 rounded-lg border border-border/70 bg-card/85 p-4 transition hover:-translate-y-0.5 hover:border-primary/30">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
          <span className="text-sm font-semibold text-foreground">{service.label}</span>
        </Link>
      ); })}
    </div>
  );
}

export function ChurchDashboardQuickActions({ config }: { config: StaffMobileConfig | null }) {
  return config ? <VisibleChurchDashboardQuickActions config={config} /> : <div data-testid="church-dashboard-quick-actions" />;
}

export function ChurchDashboardExperience({
  intelligence,
  administratorName,
  greeting,
  churchName,
  activeMembers,
  totalMembers,
  announcementCount,
  upcomingEventCount,
  attendance,
  recentActivity,
  criticalLoading,
  deferredLoading,
}: ChurchDashboardExperienceProps) {
  const counts = intelligence.pending.data ?? EMPTY_PENDING_COUNTS;
  const financial = intelligence.financial.data ?? EMPTY_FINANCIAL_SUMMARY;
  const priorities = visiblePendingActions(counts, intelligence.staffWorkspace);
  const pendingTotal = priorities.reduce((sum, item) => sum + item.count, 0);
  const quickActionConfig = getStaffMobileConfig(intelligence.staffWorkspace);
  const workspaceLabel =
    intelligence.staffWorkspace === "admin" ? "Church Admin Workspace" :
    intelligence.staffWorkspace === "finance" ? "Finance Workspace" :
    intelligence.staffWorkspace === "pastoral" ? "Pastoral Workspace" :
    intelligence.staffWorkspace === "super_admin" ? "Super Admin Workspace" :
    "Staff Workspace";
  const briefingLabel =
    intelligence.staffWorkspace === "admin" ? "Church Admin" :
    intelligence.staffWorkspace === "finance" ? "Finance" :
    intelligence.staffWorkspace === "pastoral" ? "Pastoral" :
    intelligence.staffWorkspace === "super_admin" ? "Super Admin" :
    "Staff";

  const briefingRows = [
    {
      label: "Member activity",
      value: criticalLoading ? null : `${activeMembers} active of ${totalMembers} registered members`,
    },
    intelligence.pendingEnabled
      ? {
          label: "Pending work",
          value: intelligence.pending.isLoading ? null : intelligence.pending.isError ? "Temporarily unavailable" : pendingTotal ? `${pendingTotal} items need attention` : "No pending work",
        }
      : null,
    {
      label: "Next Mass and attendance",
      value: deferredLoading
        ? null
        : attendance.title
          ? `${attendance.yes} confirmed, ${attendance.maybe} maybe · ${attendance.responseRate.toFixed(0)}% response`
          : "No upcoming Mass is scheduled",
    },
    {
      label: "Parish communication",
      value: criticalLoading || deferredLoading ? null : `${announcementCount} recent announcements · ${upcomingEventCount} upcoming events`,
    },
    intelligence.financialEnabled
      ? {
          label: "Verified receipts",
          value: intelligence.financial.isLoading
            ? null
            : intelligence.financial.isError
              ? "Financial summary is temporarily unavailable"
              : `${formatTZS(financial.thisMonthReceived)} received this month across ${financial.transactionCount} transactions`,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string | null }>;

  const snapshot = [
    { label: "Active members", value: String(activeMembers), detail: `${totalMembers} total registered` },
    {
      label: "Expected attendance",
      value: String(attendance.yes),
      detail: attendance.title || "No upcoming Mass scheduled",
    },
    { label: "Recent announcements", value: String(announcementCount), detail: "Published parish updates" },
    { label: "Upcoming events", value: String(upcomingEventCount), detail: "Future programs scheduled" },
  ];

  return (
    <div className="space-y-8" data-testid="church-dashboard-parity-core">
      <section aria-label="Workspace briefing" className="rounded-xl border border-primary/20 bg-card/85 p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-serif text-2xl font-bold text-foreground">{greeting}, {administratorName.split(" ")[0]}.</p>
              <p className="mt-1 text-sm text-muted-foreground">Here is your {briefingLabel} briefing for today at {churchName || "your parish"}.</p>
              <p className="mt-3 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {workspaceLabel}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
              Today&apos;s Focus
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{intelligence.pending.isLoading || intelligence.pending.isError ? "Review authorized work queues." : <>Review {pendingTotal} pending work item{pendingTotal === 1 ? "" : "s"}.</>}</li>
              <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Support {activeMembers} active parish members.</li>
              <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Track {upcomingEventCount} upcoming event{upcomingEventCount === 1 ? "" : "s"}.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="church-dashboard-priorities">
        <SectionHeading id="church-dashboard-priorities" title="Today's Priorities" description="Production work queues that need action from your current role." />
        {intelligence.pending.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-36 rounded-lg" /><Skeleton className="h-36 rounded-lg" /></div>
        ) : intelligence.pending.isError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Priorities are temporarily unavailable. No access has been broadened.</div>
        ) : priorities.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {priorities.map((item) => (
              <Link key={item.key} to={item.route} className="flex min-h-36 flex-col justify-between rounded-lg border border-border/70 bg-card/85 p-4 transition hover:border-primary/35">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Action required</p><h3 className="mt-3 text-sm font-semibold text-foreground">{item.label}</h3><p className="mt-1 text-sm text-muted-foreground">{item.count} waiting for review</p></div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open queue <ChevronRight className="h-3.5 w-3.5" /></span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success"><CheckCircle2 className="h-5 w-5" /></span>
            <div><p className="text-sm font-semibold text-foreground">No priorities need attention</p><p className="text-sm text-muted-foreground">Your authorized production work queues are clear.</p></div>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="church-dashboard-briefing">
        <SectionHeading id="church-dashboard-briefing" title="Assistant Daily Briefing" description="A deterministic summary derived only from current production dashboard data." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {briefingRows.map((row) => (
            <div key={row.label} className="rounded-lg border border-border/70 bg-card/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">{row.label}</p>
              {row.value === null ? <Skeleton className="mt-3 h-5 w-4/5" /> : <p className="mt-2 text-sm leading-6 text-foreground/80">{row.value}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="church-dashboard-snapshot">
        <SectionHeading id="church-dashboard-snapshot" title="Operational Snapshot" description="Compact parish signals from the existing production dashboard queries." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {snapshot.map((item) => (
            <div key={item.label} className="rounded-lg border border-border/70 bg-card/85 p-4">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              {criticalLoading || (deferredLoading && item.label !== "Active members") ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <ChurchAdminLiveMediaAwareness />

      <section className="space-y-3" aria-labelledby="church-dashboard-release-b">
        <SectionHeading id="church-dashboard-release-b" title="Pending Work + Financial Summary" description="Release B intelligence with its existing authorization and RPC contracts." />
        <ChurchDashboardIntelligenceView intelligence={intelligence} />
      </section>

      <section className="space-y-3" aria-labelledby="church-dashboard-activity">
        <SectionHeading id="church-dashboard-activity" title="Today's Activity Timeline" description="Recent records already loaded for this production dashboard." />
        <div className="rounded-lg border border-border/70 bg-card/85 p-4 sm:p-5">
          {deferredLoading && !recentActivity.length ? <Skeleton className="h-32 rounded-lg" /> : recentActivity.length ? (
            <ol className="space-y-3">
              {recentActivity.map((item) => (
                <li key={item.id} className="grid gap-2 rounded-lg border border-border/60 bg-background/50 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
                  <time className="inline-flex items-center gap-1 text-xs font-medium text-primary" dateTime={item.date}><Clock3 className="h-3.5 w-3.5" />{new Date(item.date).toLocaleDateString("en-TZ", { day: "numeric", month: "short" })}</time>
                  <div><p className="text-sm font-semibold text-foreground">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p></div>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">No recent production activity is available.</p>}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="church-dashboard-actions">
        <SectionHeading id="church-dashboard-actions" title="Quick Actions" description="Authorized and feature-aware production services for this workspace." />
        <ChurchDashboardQuickActions config={quickActionConfig} />
      </section>
    </div>
  );
}
