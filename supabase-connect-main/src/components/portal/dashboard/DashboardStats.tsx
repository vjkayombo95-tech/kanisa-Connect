import { useMemo } from "react";
import { CalendarDays, Flame, MessageCircle } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { emptyParishCalendarFilters, formatCalendarTime } from "@/components/calendar/calendarUtils";
import { useParishCalendarEvents } from "@/hooks/useParishCalendar";
import { cn } from "@/lib/utils";

import type { MemberJourneySummary, NextMassSummary } from "./types";
import { formatDate } from "./utils";

function SummaryTile({
  icon: Icon,
  label,
  title,
  details,
  emptyText,
  isEmpty,
  isLoading,
  isError,
  actionLabel,
  actionTo,
  className,
}: {
  icon: typeof Flame;
  label: string;
  title: string | null;
  details: Array<{ label: string; value: string | null }>;
  emptyText: string;
  isEmpty?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  actionLabel: string;
  actionTo: string;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-[28px] border-border/70 bg-card/85 shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
        {isLoading ? (
          <p className="mt-2 text-sm font-semibold text-muted-foreground">Inapakia...</p>
        ) : isError ? (
          <p className="mt-2 text-sm font-semibold text-destructive">Unavailable</p>
        ) : isEmpty ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{emptyText}</p>
        ) : (
          <>
            <p className="mt-1 line-clamp-2 break-words text-xl font-bold tracking-tight text-foreground">{title}</p>
            <div className="mt-3 space-y-2">
              {details.map((detail) =>
                detail.value ? (
                  <div key={detail.label}>
                    <p className="text-[11px] font-medium uppercase text-muted-foreground">{detail.label}</p>
                    <p className="break-words text-sm font-semibold text-foreground">{detail.value}</p>
                  </div>
                ) : null,
              )}
            </div>
          </>
        )}
        <Button asChild variant="outline" size="sm" className="mt-4 h-9 rounded-xl">
          <AppLink to={actionTo}>{actionLabel}</AppLink>
        </Button>
      </CardContent>
    </Card>
  );
}

function cleanLabel(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DashboardStats({
  massVisible = true,
  churchId,
  massIntentionsError,
  massIntentionsSummary,
  massIntentionsLoading,
  prayerRequestsVisible = true,
  prayerRequestsError,
  prayerRequestsSummary,
  prayerRequestsLoading,
  massSummary,
}: {
  massVisible?: boolean;
  churchId?: string | null;
  massIntentionsError?: boolean;
  massIntentionsSummary?: MemberJourneySummary;
  massIntentionsLoading?: boolean;
  prayerRequestsVisible?: boolean;
  prayerRequestsError?: boolean;
  prayerRequestsSummary?: MemberJourneySummary;
  prayerRequestsLoading?: boolean;
  massSummary?: NextMassSummary;
}) {
  const nextMass = massSummary?.mass ?? null;
  const { events, isLoading: scheduleLoading, isError: scheduleError } = useParishCalendarEvents({
    churchId,
    filters: emptyParishCalendarFilters,
    workspace: "member",
  });
  const nextSchedule = useMemo(() => {
    const now = Date.now();

    return (
      events
        .filter((event) => new Date(event.startsAt).getTime() >= now)
        .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime())[0] ?? null
    );
  }, [events]);
  const massTitle = massIntentionsSummary?.title || (nextMass ? nextMass.title : null);
  const massScheduleDate = massIntentionsSummary?.scheduledDate || nextMass?.mass_date || null;
  const massScheduleTime = massIntentionsSummary?.scheduledTime || nextMass?.start_time || null;

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {massVisible ? (
        <SummaryTile
          icon={Flame}
          label="Mass Intentions"
          title={massTitle}
          details={[
            { label: "Next Scheduled Mass", value: massScheduleDate ? `${formatDate(massScheduleDate)}${massScheduleTime ? ` at ${massScheduleTime}` : ""}` : null },
            { label: "Requested Intention", value: massIntentionsSummary?.description ?? null },
            { label: "Status", value: cleanLabel(massIntentionsSummary?.latestStatus) },
          ]}
          emptyText="No active Mass intentions."
          isEmpty={!massIntentionsSummary?.activeCount}
          isLoading={massIntentionsLoading}
          isError={massIntentionsError}
          actionLabel="Request Mass Intention"
          actionTo="/portal/mass-intentions"
        />
      ) : null}
      {prayerRequestsVisible ? (
        <SummaryTile
          icon={MessageCircle}
          label="Prayer Requests"
          title={prayerRequestsSummary?.title}
          details={[
            { label: "Current Status", value: cleanLabel(prayerRequestsSummary?.latestStatus) },
            { label: "Submitted", value: prayerRequestsSummary?.latestDate ? formatDate(prayerRequestsSummary.latestDate) : null },
          ]}
          emptyText="No active prayer requests."
          isEmpty={!prayerRequestsSummary?.activeCount}
          isLoading={prayerRequestsLoading}
          isError={prayerRequestsError}
          actionLabel="Submit Prayer Request"
          actionTo="/portal/prayer-requests"
        />
      ) : null}
      <SummaryTile
        icon={CalendarDays}
        label="Upcoming Schedule"
        title={nextSchedule?.title ?? null}
        details={[
          { label: "Date", value: nextSchedule ? formatDate(nextSchedule.startsAt) : null },
          { label: "Time", value: nextSchedule ? formatCalendarTime(nextSchedule.startsAt) : null },
          { label: "Location", value: nextSchedule?.location || nextSchedule?.ministry || null },
        ]}
        emptyText="No upcoming parish activities."
        isEmpty={!nextSchedule}
        isLoading={scheduleLoading}
        isError={scheduleError}
        actionLabel="Open Parish Calendar"
        actionTo="/portal/calendar"
      />
    </section>
  );
}
