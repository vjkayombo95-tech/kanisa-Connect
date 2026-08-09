import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  dateKey,
  filterParishCalendarEvents,
  startOfDay,
} from "@/components/calendar/calendarUtils";
import { fetchParishCalendarFeed } from "@/lib/calendar";
import type {
  ParishCalendarEvent,
  ParishCalendarFilters,
  ParishCalendarWorkspace,
} from "@/components/calendar/types";

type ParishCalendarRange = {
  from: Date;
  to: Date;
};

export function getParishCalendarQueryKey(
  churchId: string | null | undefined,
  workspace?: ParishCalendarWorkspace,
  range?: ParishCalendarRange,
) {
  return range
    ? ["parish-calendar-events", churchId, workspace ?? "shared", dateKey(range.from), dateKey(range.to)] as const
    : ["parish-calendar-events", churchId, workspace ?? "shared"] as const;
}

export function useParishCalendarEvents({
  churchId,
  filters,
  workspace,
  range,
  enabled = true,
}: {
  churchId: string | null | undefined;
  filters: ParishCalendarFilters;
  workspace: ParishCalendarWorkspace;
  range?: ParishCalendarRange;
  enabled?: boolean;
}) {
  const query = useQuery({
    queryKey: getParishCalendarQueryKey(churchId, workspace, range),
    queryFn: async (): Promise<ParishCalendarEvent[]> => {
      if (!churchId) return [];
      return fetchParishCalendarFeed({ churchId, workspace, from: range?.from, to: range?.to });
    },
    enabled: enabled && !!churchId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const filteredEvents = useMemo(
    () => filterParishCalendarEvents(query.data ?? [], filters, workspace),
    [filters, query.data, workspace],
  );

  const todaysEvents = useMemo(() => {
    const today = dateKey(startOfDay(new Date()));
    return filteredEvents.filter((event) => dateKey(event.startsAt) === today);
  }, [filteredEvents]);

  return {
    ...query,
    events: filteredEvents,
    rawEvents: query.data ?? [],
    todaysEvents,
  };
}
