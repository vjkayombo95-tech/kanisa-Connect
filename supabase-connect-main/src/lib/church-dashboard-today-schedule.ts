const TANZANIA_TIME_ZONE = "Africa/Dar_es_Salaam";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TANZANIA_TIME_ZONE,
  year: "numeric",
});

export type TodayScheduleItem = {
  id: string;
  source: "mass_occurrence" | "event";
  title: string;
  time: string | null;
  location: string | null;
  status: string | null;
  eventType: string | null;
  sortKey: string;
};

export type TodayMassOccurrenceRow = {
  id: string;
  church_id: string;
  occurrence_date: string;
  start_time: string | null;
  end_time?: string | null;
  name: string;
  location_name: string | null;
  status: string | null;
};

export type TodayEventRow = {
  id: string;
  church_id: string;
  title: string;
  start_date: string | null;
  end_date?: string | null;
  location: string | null;
  event_type: string | null;
  archived_at: string | null;
};

export function getTanzaniaDateKey(now = new Date()) {
  return dateKeyFormatter.format(now);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getTanzaniaTimestampBounds(dateKey: string) {
  return {
    start: `${dateKey}T00:00:00`,
    end: `${addDaysToDateKey(dateKey, 1)}T00:00:00`,
  };
}

export function formatScheduleTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : null;
}

export function getEventTimeKey(value: string | null | undefined) {
  if (!value) return "99:99";
  const time = value.includes("T") ? value.split("T")[1] : value.split(" ")[1];
  return time?.slice(0, 5) || "99:99";
}

export function combineTodaySchedule({
  occurrences,
  events,
}: {
  occurrences: TodayMassOccurrenceRow[];
  events: TodayEventRow[];
}): TodayScheduleItem[] {
  return [
    ...occurrences.map((occurrence) => ({
      id: `mass-occurrence-${occurrence.id}`,
      source: "mass_occurrence" as const,
      title: occurrence.name,
      time: formatScheduleTime(occurrence.start_time),
      location: occurrence.location_name,
      status: occurrence.status,
      eventType: null,
      sortKey: `${formatScheduleTime(occurrence.start_time) ?? "99:99"}:0:${occurrence.id}`,
    })),
    ...events.map((event) => ({
      id: `event-${event.id}`,
      source: "event" as const,
      title: event.title,
      time: getEventTimeKey(event.start_date) === "99:99" ? null : getEventTimeKey(event.start_date),
      location: event.location,
      status: event.event_type,
      eventType: event.event_type,
      sortKey: `${getEventTimeKey(event.start_date)}:1:${event.id}`,
    })),
  ].sort((left, right) => left.sortKey.localeCompare(right.sortKey));
}
