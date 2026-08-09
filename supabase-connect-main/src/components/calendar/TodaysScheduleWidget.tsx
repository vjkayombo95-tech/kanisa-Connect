import { CalendarDays } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useParishCalendarEvents } from "@/hooks/useParishCalendar";
import { emptyParishCalendarFilters, formatCalendarTime } from "./calendarUtils";
import type { ParishCalendarWorkspace } from "./types";

type TodaysScheduleWidgetProps = {
  churchId: string | null | undefined;
  workspace: ParishCalendarWorkspace;
  calendarPath: string;
};

export function TodaysScheduleWidget({ churchId, workspace, calendarPath }: TodaysScheduleWidgetProps) {
  const { todaysEvents, isLoading, isError } = useParishCalendarEvents({
    churchId,
    filters: emptyParishCalendarFilters,
    workspace,
  });

  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            Today's Schedule
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <AppLink to={calendarPath}>Open Parish Calendar</AppLink>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        ) : isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Today's schedule could not be loaded.
          </p>
        ) : todaysEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scheduled items for today.</p>
        ) : (
          <div className="space-y-3">
            {todaysEvents.slice(0, 4).map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{event.location || event.ministry || "Parish schedule"}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-primary">{formatCalendarTime(event.startsAt)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
