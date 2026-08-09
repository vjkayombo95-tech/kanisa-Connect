import { useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, HandHeart, Users } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { emptyParishCalendarFilters, formatCalendarDate, formatCalendarTime } from "@/components/calendar/calendarUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMember } from "@/hooks/useMember";
import { useParishCalendarEvents } from "@/hooks/useParishCalendar";
import { fetchMinistrySummaries, getMyMinistriesQueryKey } from "@/lib/ministries";

type MemberMinistryDashboardProps = {
  churchId: string | null | undefined;
};

function CardShell({
  title,
  icon: Icon,
  children,
  actionLabel,
  actionTo,
}: {
  title: string;
  icon: typeof Users;
  children: ReactNode;
  actionLabel: string;
  actionTo: string;
}) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
            {title}
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <AppLink to={actionTo}>{actionLabel}</AppLink>
          </Button>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function MyMinistriesCard({ churchId }: MemberMinistryDashboardProps) {
  const { data: member } = useMember("id, full_name, church_id");
  const memberId = member?.id ?? null;
  const { data: ministries = [], isLoading, isError } = useQuery({
    queryKey: getMyMinistriesQueryKey(memberId, churchId),
    queryFn: () => fetchMinistrySummaries({ churchId, memberId }),
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const myMinistries = ministries.filter((ministry) => ministry.isMember);

  return (
    <CardShell title="My Ministries" icon={Users} actionLabel="Browse" actionTo="/portal/ministries">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ) : isError ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Ministries could not be loaded.
        </p>
      ) : myMinistries.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have not joined a ministry yet.</p>
      ) : (
        <div className="space-y-2">
          {myMinistries.slice(0, 3).map((ministry) => (
            <AppLink
              key={ministry.id}
              to={`/portal/ministries/${ministry.id}`}
              className="block rounded-2xl border border-border/60 bg-background/50 p-3 text-sm font-semibold hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ministry.name}
            </AppLink>
          ))}
        </div>
      )}
    </CardShell>
  );
}

export function TodaysMinistryScheduleCard({ churchId }: MemberMinistryDashboardProps) {
  const { data: member } = useMember("id, full_name, church_id");
  const memberId = member?.id ?? null;
  const { data: ministries = [] } = useQuery({
    queryKey: getMyMinistriesQueryKey(memberId, churchId),
    queryFn: () => fetchMinistrySummaries({ churchId, memberId }),
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { events, isLoading, isError } = useParishCalendarEvents({
    churchId,
    filters: emptyParishCalendarFilters,
    workspace: "member",
  });
  const myMinistryNames = useMemo(
    () => new Set(ministries.filter((ministry) => ministry.isMember).map((ministry) => ministry.name).filter(Boolean)),
    [ministries],
  );
  const schedule = useMemo(() => {
    const today = new Date().toDateString();
    return events
      .filter((event) => event.ministry && myMinistryNames.has(event.ministry))
      .filter((event) => new Date(event.startsAt).toDateString() === today)
      .slice(0, 3);
  }, [events, myMinistryNames]);

  return (
    <CardShell title="Today's Ministry Schedule" icon={CalendarDays} actionLabel="Calendar" actionTo="/portal/calendar">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ) : isError ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Ministry schedule could not be loaded.
        </p>
      ) : schedule.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ministry schedule for today.</p>
      ) : (
        <div className="space-y-3">
          {schedule.map((event) => (
            <div key={event.id} className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <p className="text-sm font-semibold text-foreground">{event.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCalendarTime(event.startsAt)} - {event.location || event.ministry}
              </p>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

export function VolunteerOpportunitiesCard({ churchId }: MemberMinistryDashboardProps) {
  const { events, isLoading, isError } = useParishCalendarEvents({
    churchId,
    filters: emptyParishCalendarFilters,
    workspace: "member",
  });
  const opportunities = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => event.ministry)
      .filter((event) => new Date(event.startsAt).getTime() >= now)
      .slice(0, 3);
  }, [events]);

  return (
    <CardShell title="Volunteer Opportunities" icon={HandHeart} actionLabel="Explore" actionTo="/portal/ministries">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ) : isError ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Opportunities could not be loaded.
        </p>
      ) : opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ministry opportunities are scheduled yet.</p>
      ) : (
        <div className="space-y-3">
          {opportunities.map((event) => (
            <div key={event.id} className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <p className="text-sm font-semibold text-foreground">{event.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.ministry} - {formatCalendarDate(event.startsAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}
