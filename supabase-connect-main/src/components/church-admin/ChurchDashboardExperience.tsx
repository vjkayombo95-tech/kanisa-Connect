import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useVisibleStaffServices } from "@/components/staff-mobile/StaffMobileExperience";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChurchDashboardIntelligenceState } from "@/components/church-admin/ChurchDashboardIntelligence";
import {
  EMPTY_FINANCIAL_SUMMARY,
  EMPTY_PENDING_COUNTS,
  visiblePendingActions,
} from "@/lib/church-dashboard-intelligence";
import { formatTZS } from "@/lib/currency";
import {
  getStaffMobileConfig,
  type StaffMobileConfig,
} from "@/lib/staff-mobile-registry";
import { translateStaffServiceLabel } from "@/lib/localization";
import { useTranslation } from "react-i18next";

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
  userRole: string | null;
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
  recentActivity: ChurchDashboardActivityItem[];
  criticalLoading: boolean;
  deferredLoading: boolean;
};

const quickActionIds = new Set([
  "members",
  "contributions",
  "announcements",
  "mass-intentions",
  "events",
]);

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2
        id={id}
        className="font-serif text-xl font-semibold text-foreground"
      >
        {title}
      </h2>

      <p className="mt-1 text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function VisibleChurchDashboardQuickActions({
  config,
}: {
  config: StaffMobileConfig;
}) {
  const { t } = useTranslation();
  const { services } = useVisibleStaffServices(config);

  const quickActions = services.filter((service) =>
    quickActionIds.has(service.id),
  );

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      data-testid="church-dashboard-quick-actions"
    >
      {quickActions.map((service) => {
        const Icon = service.icon;

        return (
          <Link
            key={service.id}
            to={service.route}
            className="flex min-h-20 items-center gap-3 rounded-xl border border-border/70 bg-card/85 p-4 transition hover:-translate-y-0.5 hover:border-primary/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>

            <span className="text-sm font-semibold text-foreground">
              {translateStaffServiceLabel(t, service)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function ChurchDashboardQuickActions({
  config,
}: {
  config: StaffMobileConfig | null;
}) {
  return config ? (
    <VisibleChurchDashboardQuickActions config={config} />
  ) : (
    <div data-testid="church-dashboard-quick-actions" />
  );
}

export function ChurchDashboardExperience({
  userRole,
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
  recentActivity,
  criticalLoading,
  deferredLoading,
}: ChurchDashboardExperienceProps) {
  const counts =
    intelligence.pending.data ?? EMPTY_PENDING_COUNTS;

  const financial =
    intelligence.financial.data ?? EMPTY_FINANCIAL_SUMMARY;

  const priorities = visiblePendingActions(
    counts,
    intelligence.staffWorkspace,
  );

  const pendingTotal = priorities.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  const quickActionConfig = getStaffMobileConfig(
    intelligence.staffWorkspace,
  );

 const workspaceLabel =
  userRole === "church_admin"
    ? "Msimamizi wa Kanisa"
    : userRole === "secretary"
      ? "Sekretarieti"
      : userRole === "pastor" || userRole === "priest"
        ? "Kichungaji"
        : userRole === "treasurer" || userRole === "finance"
          ? "Fedha na Michango"
          : userRole === "super_admin"
            ? "Super Admin"
            : intelligence.staffWorkspace === "admin"
              ? "Usimamizi wa Kanisa"
              : "Staff";
  const firstName =
    administratorName.trim().split(" ")[0] ||
    administratorName;

  const statusMessage =
    intelligence.pending.isLoading
      ? "Tunakusanya kazi zinazohitaji umakini wako."
      : intelligence.pending.isError
        ? "Baadhi ya taarifa hazipatikani kwa sasa."
        : pendingTotal > 0
          ? `Una kazi ${pendingTotal} zinazohitaji umakini wako leo.`
          : "Hakuna kazi ya haraka inayosubiri kwa sasa.";

  return (
    <div
      className="space-y-8"
      data-testid="church-dashboard-parity-core"
    >
      <section
        aria-label="Workspace briefing"
        className={`relative overflow-hidden rounded-2xl border border-primary/20 p-5 shadow-sm sm:p-6 ${bannerUrl ? "min-h-[250px] bg-cover text-white sm:min-h-[260px]" : "bg-card/85"}`}
        style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")`, backgroundPosition: `center ${bannerPositionY}%` } : undefined}
      >
        {bannerUrl ? <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15" aria-hidden="true" /> : null}
        <div className="relative z-10 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles
              className="h-6 w-6"
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0">
            <p className={`font-serif text-2xl font-bold ${bannerUrl ? "text-white" : "text-foreground"}`}>
              {greeting}, {firstName}.
            </p>

            <p className={`mt-1 text-sm leading-6 ${bannerUrl ? "text-white/80" : "text-muted-foreground"}`}>
              {statusMessage}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${bannerUrl ? "border-white/25 bg-black/30 text-white" : "border-primary/20 bg-primary/10 text-primary"}`}>
                {workspaceLabel}
              </span>

              {churchName ? (
                <span className={`text-xs ${bannerUrl ? "text-white/75" : "text-muted-foreground"}`}>
                  {churchName}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section
        className="space-y-3"
        aria-labelledby="church-dashboard-priorities"
      >
        <SectionHeading
          id="church-dashboard-priorities"
          title="Cha kufanya leo"
          description="Kazi muhimu zinazohitaji hatua kutoka kwako."
        />

        {intelligence.pending.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : intelligence.pending.isError ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Kazi zinazohitaji hatua hazipatikani kwa muda.
            Ruhusa zako hazijabadilishwa.
          </div>
        ) : priorities.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {priorities.slice(0, 4).map((item) => (
              <Link
                key={item.key}
                to={item.route}
                className="flex min-h-32 flex-col justify-between rounded-xl border border-border/70 bg-card/85 p-4 transition hover:border-primary/35"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Inahitaji hatua
                  </p>

                  <h3 className="mt-3 text-sm font-semibold text-foreground">
                    {item.label}
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.count} zinahitaji kuangaliwa
                  </p>
                </div>

                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  Fungua
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </span>

            <div>
              <p className="text-sm font-semibold text-foreground">
                Uko sawa kwa sasa
              </p>

              <p className="text-sm text-muted-foreground">
                Hakuna kazi ya haraka inayosubiri hatua yako.
              </p>
            </div>
          </div>
        )}
      </section>

      <section
        className="space-y-3"
        aria-labelledby="church-dashboard-actions"
      >
        <SectionHeading
          id="church-dashboard-actions"
          title="Haraka"
          description="Fungua kazi unayotumia mara nyingi."
        />

        <ChurchDashboardQuickActions
          config={quickActionConfig}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section
          className="space-y-3"
          aria-labelledby="church-dashboard-today"
        >
          <SectionHeading
            id="church-dashboard-today"
            title="Ratiba ya leo"
            description="Misa, shughuli na taarifa muhimu za leo."
          />

          <div className="rounded-xl border border-border/70 bg-card/85 p-5">
            {deferredLoading ? (
              <Skeleton className="h-28 rounded-lg" />
            ) : attendance.title ? (
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {attendance.title}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-2xl font-semibold text-foreground">
                      {attendance.yes}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Wamethibitisha
                    </p>
                  </div>

                  <div>
                    <p className="text-2xl font-semibold text-foreground">
                      {attendance.maybe}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Labda
                    </p>
                  </div>

                  <div>
                    <p className="text-2xl font-semibold text-foreground">
                      {attendance.responseRate.toFixed(0)}%
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Majibu
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Hakuna Misa inayofuata iliyoratibiwa kwa
                sasa.
              </p>
            )}

            {!deferredLoading &&
            upcomingEventCount > 0 ? (
              <p className="mt-4 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                Pia kuna shughuli {upcomingEventCount} zijazo.
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="space-y-3"
          aria-labelledby="church-dashboard-summary"
        >
          <SectionHeading
            id="church-dashboard-summary"
            title="Muhtasari wa kanisa"
            description="Taarifa chache muhimu bila kukujaza takwimu nyingi."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-card/85 p-4">
              <p className="text-sm text-muted-foreground">
                Waumini hai
              </p>

              {criticalLoading ? (
                <Skeleton className="mt-3 h-8 w-20" />
              ) : (
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {activeMembers}
                </p>
              )}

              <p className="mt-1 text-xs text-muted-foreground">
                kati ya {totalMembers} waliosajiliwa
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/85 p-4">
              <p className="text-sm text-muted-foreground">
                Matangazo ya karibuni
              </p>

              {criticalLoading ? (
                <Skeleton className="mt-3 h-8 w-20" />
              ) : (
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {announcementCount}
                </p>
              )}

              <p className="mt-1 text-xs text-muted-foreground">
                taarifa zilizochapishwa
              </p>
            </div>

            {intelligence.financialEnabled ? (
              <div className="rounded-xl border border-border/70 bg-card/85 p-4 sm:col-span-2">
                <p className="text-sm text-muted-foreground">
                  Michango iliyothibitishwa mwezi huu
                </p>

                {intelligence.financial.isLoading ? (
                  <Skeleton className="mt-3 h-8 w-32" />
                ) : intelligence.financial.isError ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Muhtasari wa fedha haupatikani kwa muda.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formatTZS(
                        financial.thisMonthReceived,
                      )}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      miamala {financial.transactionCount}
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section
        className="space-y-3"
        aria-labelledby="church-dashboard-activity"
      >
        <SectionHeading
          id="church-dashboard-activity"
          title="Shughuli za karibuni"
          description="Mambo ya mwisho yaliyorekodiwa kwenye kanisa."
        />

        <div className="rounded-xl border border-border/70 bg-card/85 p-4 sm:p-5">
          {deferredLoading && !recentActivity.length ? (
            <Skeleton className="h-28 rounded-lg" />
          ) : recentActivity.length ? (
            <ol className="space-y-3">
              {recentActivity.slice(0, 4).map((item) => (
                <li
                  key={item.id}
                  className="grid gap-2 rounded-lg border border-border/60 bg-background/50 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]"
                >
                  <time
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                    dateTime={item.date}
                  >
                    <Clock3 className="h-3.5 w-3.5" />

                    {new Date(
                      item.date,
                    ).toLocaleDateString("sw-TZ", {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>

                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Hakuna shughuli za karibuni.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
