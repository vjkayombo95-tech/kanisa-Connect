import { supabase } from "@/integrations/supabase/client";
import {
  addDays,
  categoryColor,
  categoryForEventType,
  dateKey,
  inferEventType,
  startOfDay,
} from "@/components/calendar/calendarUtils";
import type {
  ParishCalendarCategory,
  ParishCalendarEvent,
  ParishCalendarEventType,
  ParishEventAudienceMode,
  ParishEventAudienceTarget,
  ParishCalendarVisibility,
  ParishCalendarWorkspace,
} from "@/components/calendar/types";
import { mapSacramentToCalendarEvent, type SacramentalRecord } from "@/lib/sacraments";
import {
  describeRecurrenceRule,
  expandRecurringCalendarEvent,
  normalizeRecurrenceRule,
  type CalendarRecurrenceFrequency,
  type CalendarMonthlyPattern,
} from "@/lib/calendar/recurrence";

type EventRow = {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  status: string | null;
  archived_at?: string | null;
  event_type?: string | null;
  ministry?: string | null;
  visibility?: string | null;
  audience_mode?: string | null;
  recurrence_frequency?: string | null;
  recurrence_interval?: number | null;
  recurrence_days_of_week?: number[] | null;
  recurrence_end_date?: string | null;
  recurrence_count?: number | null;
  recurrence_monthly_pattern?: string | null;
  recurrence_monthly_week?: number | null;
  recurrence_monthly_weekday?: number | null;
};

type EventAudienceTargetRow = {
  event_id: string;
  ministry_id: string | null;
  community_id: string | null;
  ministries?: { name: string | null } | null;
  communities?: { name: string | null } | null;
};

type MassEventRow = {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  mass_date: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
};

type MassIntentionRow = {
  id: string;
  church_id: string;
  intention_type: string | null;
  message: string | null;
  status: string | null;
  mass_date?: string | null;
  mass_time?: string | null;
  mass_name?: string | null;
  created_at: string;
};

type LiturgicalDayRow = {
  id: string;
  date: string;
  celebration: string;
  season: string | null;
  liturgical_color: string | null;
  rank: string | null;
  daily_readings?: Array<{
    id: string;
    gospel_reference: string | null;
    first_reading_reference: string | null;
    responsorial_psalm_reference: string | null;
    second_reading_reference: string | null;
  }> | null;
};

type CmsDailyReadingRow = {
  id: string;
  reading_date: string;
  celebration: string | null;
  liturgical_season: string | null;
  liturgical_color: string | null;
  first_reading_reference: string | null;
  responsorial_psalm_reference: string | null;
  second_reading_reference: string | null;
  gospel_reference: string | null;
  status: string | null;
  visibility: string | null;
};

type AnnouncementRow = {
  id: string;
  church_id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  archived_at: string | null;
  status?: string | null;
  featured?: boolean | null;
  publish_at?: string | null;
  expires_at?: string | null;
  never_expires?: boolean | null;
  audience?: string[] | null;
  category?: string | null;
  show_on_calendar?: boolean | null;
};

type EventRequestRow = {
  id: string;
  church_id: string;
  member_id: string | null;
  title: string | null;
  description: string | null;
  request_type: string | null;
  status: string | null;
  preferred_date: string | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  location_preference: string | null;
  ministry_id: string | null;
  community_id: string | null;
  converted_event_id: string | null;
  converted_mass_event_id: string | null;
  created_at: string;
  ministries?: { name: string | null } | null;
  communities?: { name: string | null } | null;
};

export type ParishCalendarFeedInput = {
  churchId: string;
  workspace: ParishCalendarWorkspace;
  from?: Date;
  to?: Date;
};

export type RecurringMassRule = {
  id: string;
  churchId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  weekdays: number[];
  startTime: string;
  endTime?: string | null;
  startsOn: string;
  endsOn?: string | null;
};

function combineDateAndTime(date: string, time: string | null | undefined) {
  return `${date}T${(time || "00:00").slice(0, 5)}:00`;
}

function cleanVisibility(value: string | null | undefined): ParishCalendarVisibility {
  if (value === "member" || value === "pastoral" || value === "admin" || value === "finance") return value;
  return "public";
}

function cleanAudienceMode(value: string | null | undefined): ParishEventAudienceMode {
  if (value === "all_members" || value === "specific_groups") return value;
  return "everyone";
}

function eventColor(category: ParishCalendarCategory) {
  return categoryColor(category);
}

function withCategory(type: ParishCalendarEventType) {
  const category = categoryForEventType(type);
  return { category, color: eventColor(category) };
}

function workspaceBase(workspace: ParishCalendarWorkspace) {
  if (workspace === "pastoral") return "/pastoral";
  if (workspace === "church_admin") return "/church-admin";
  if (workspace === "finance") return "/finance";
  if (workspace === "super_admin") return "/super-admin";
  return "/portal";
}

function sourceHref(source: ParishCalendarEvent["source"], workspace: ParishCalendarWorkspace, id?: string) {
  const base = workspaceBase(workspace);
  const calendarFallback = workspace === "super_admin" ? "/super-admin" : `${base}/calendar`;
  if (source === "events") return workspace === "finance" || workspace === "super_admin" ? calendarFallback : `${base}/events`;
  if (source === "mass_events") return workspace === "pastoral" ? "/pastoral/mass-schedule" : calendarFallback;
  if (source === "mass_intentions") return workspace === "finance" || workspace === "super_admin" ? calendarFallback : `${base}/mass-intentions`;
  if (source === "daily_readings") return workspace === "super_admin" ? "/super-admin/catholic-content/daily-readings" : `${base}/daily-readings`;
  if (source === "liturgical_calendar") {
    if (workspace === "member" || workspace === "pastoral") return `${base}/liturgical-calendar`;
    if (workspace === "super_admin") return "/super-admin/catholic-content/liturgical-calendar";
    return calendarFallback;
  }
  if (source === "announcements") return workspace === "finance" || workspace === "super_admin" ? calendarFallback : `${base}/announcements`;
  if (source === "event_requests") return workspace === "member" ? "/portal/event-requests" : calendarFallback;
  return id && workspace !== "super_admin" ? `${calendarFallback}?event=${encodeURIComponent(id)}` : calendarFallback;
}

export function mapParishEventRow(row: EventRow, audienceTargets: ParishEventAudienceTarget[] = []): ParishCalendarEvent {
  const type = row.event_type ? inferEventType(row.event_type) : inferEventType(row.title);
  const shared = withCategory(type);
  const ministry = row.ministry ?? null;

  return {
    id: `event-${row.id}`,
    title: row.title,
    description: row.description,
    type,
    ...shared,
    startsAt: row.start_date,
    endsAt: row.end_date,
    allDay: row.start_date.length === 10,
    location: row.location,
    ministry,
    community: shared.category === "community" ? ministry : null,
    churchId: row.church_id,
    visibility: cleanVisibility(row.visibility),
    audienceMode: cleanAudienceMode(row.audience_mode),
    audienceTargets,
    workspace: shared.category === "finance" ? "finance" : shared.category === "administration" ? "church_admin" : "member",
    source: "events",
    href: sourceHref("events", "church_admin", row.id),
    status: row.status,
    metadata: {
      sourceTable: "events",
      originalType: row.event_type,
      recurrenceFrequency: row.recurrence_frequency ?? "none",
      audienceMode: cleanAudienceMode(row.audience_mode),
      audienceTargets,
    },
  };
}

function isRecurringEvent(row: EventRow) {
  return row.recurrence_frequency === "daily" || row.recurrence_frequency === "weekly" || row.recurrence_frequency === "monthly";
}

export function expandParishEventRow(row: EventRow, from: Date, to: Date, audienceTargets: ParishEventAudienceTarget[] = []): ParishCalendarEvent[] {
  if (!isRecurringEvent(row)) return [mapParishEventRow(row, audienceTargets)];

  const parent = mapParishEventRow(row, audienceTargets);
  const recurrence = normalizeRecurrenceRule({
    frequency: row.recurrence_frequency as CalendarRecurrenceFrequency,
    interval: row.recurrence_interval ?? 1,
    daysOfWeek: row.recurrence_days_of_week,
    endDate: row.recurrence_end_date,
    count: row.recurrence_count,
    monthlyPattern: row.recurrence_monthly_pattern as CalendarMonthlyPattern | null,
    monthlyWeek: row.recurrence_monthly_week,
    monthlyWeekday: row.recurrence_monthly_weekday,
  });

  return expandRecurringCalendarEvent(
    {
      id: row.id,
      startsAt: row.start_date,
      endsAt: row.end_date,
      recurrence,
    },
    from,
    to,
  ).map((occurrence) => ({
    ...parent,
    id: occurrence.id,
    startsAt: occurrence.startsAt,
    endsAt: occurrence.endsAt,
    source: "generated",
    href: sourceHref("events", "church_admin", row.id),
    metadata: {
      ...parent.metadata,
      parentEventId: row.id,
      occurrenceDate: occurrence.occurrenceDate,
      occurrenceIndex: occurrence.index,
      recurrence,
      recurrenceDescription: describeRecurrenceRule(recurrence),
      editMode: "series",
    },
  }));
}

export function mapMassEventRow(row: MassEventRow): ParishCalendarEvent {
  const shared = withCategory("mass");

  return {
    id: `mass-${row.id}`,
    title: row.title,
    description: row.description,
    type: "mass",
    ...shared,
    startsAt: combineDateAndTime(row.mass_date, row.start_time),
    endsAt: row.end_time ? combineDateAndTime(row.mass_date, row.end_time) : null,
    location: null,
    ministry: "Liturgy",
    churchId: row.church_id,
    visibility: "public",
    workspace: "pastoral",
    source: "mass_events",
    href: sourceHref("mass_events", "pastoral", row.id),
    status: row.is_active ? "scheduled" : "cancelled",
    metadata: {
      sourceTable: "mass_events",
      massDate: row.mass_date,
      startTime: row.start_time,
    },
  };
}

export function mapMassIntentionRow(row: MassIntentionRow): ParishCalendarEvent {
  const date = row.mass_date ?? dateKey(row.created_at);
  const time = row.mass_time ?? undefined;
  const shared = withCategory("mass_intention");

  return {
    id: `mass-intention-${row.id}`,
    title: row.mass_name ? `Mass Intention: ${row.mass_name}` : "Mass Intention",
    description: row.message,
    type: "mass_intention",
    ...shared,
    startsAt: combineDateAndTime(date, time),
    endsAt: null,
    location: null,
    ministry: "Liturgy",
    churchId: row.church_id,
    visibility: "pastoral",
    workspace: "pastoral",
    source: "mass_intentions",
    href: sourceHref("mass_intentions", "pastoral", row.id),
    status: row.status,
    metadata: {
      sourceTable: "mass_intentions",
      intentionType: row.intention_type,
      massName: row.mass_name,
      massDate: row.mass_date,
      massTime: row.mass_time,
    },
  };
}

export function mapLiturgicalDay(row: LiturgicalDayRow): ParishCalendarEvent {
  const shared = withCategory("liturgical");

  return {
    id: `liturgical-${row.id}`,
    title: row.celebration,
    description: [row.rank, row.season, row.liturgical_color].filter(Boolean).join(" · "),
    type: "liturgical",
    ...shared,
    startsAt: `${row.date}T00:00:00`,
    endsAt: null,
    allDay: true,
    location: null,
    ministry: "Liturgy",
    churchId: null,
    visibility: "public",
    workspace: "shared",
    source: "liturgical_calendar",
    href: sourceHref("liturgical_calendar", "member", row.id),
    status: row.rank,
    metadata: {
      season: row.season,
      liturgicalColor: row.liturgical_color,
      rank: row.rank,
    },
  };
}

export function mapDailyReading(row: LiturgicalDayRow): ParishCalendarEvent | null {
  const reading = row.daily_readings?.[0];
  if (!reading) return null;

  const shared = withCategory("daily_reading");
  const references = [
    reading.first_reading_reference,
    reading.responsorial_psalm_reference,
    reading.second_reading_reference,
    reading.gospel_reference,
  ].filter(Boolean);

  return {
    id: `daily-reading-${reading.id}`,
    title: `Today's Readings: ${row.celebration}`,
    description: references.join(" · "),
    type: "daily_reading",
    ...shared,
    startsAt: `${row.date}T06:00:00`,
    endsAt: null,
    location: null,
    ministry: "Liturgy",
    churchId: null,
    visibility: "public",
    workspace: "shared",
    source: "daily_readings",
    href: sourceHref("daily_readings", "member", reading.id),
    status: "available",
    metadata: {
      liturgicalDayId: row.id,
      gospelReference: reading.gospel_reference,
    },
  };
}

export function mapCmsDailyReading(row: CmsDailyReadingRow): ParishCalendarEvent | null {
  if (!["published", "featured"].includes(row.status ?? "") || !["public", "member"].includes(row.visibility ?? "")) return null;

  const shared = withCategory("daily_reading");
  const references = [
    row.first_reading_reference,
    row.responsorial_psalm_reference,
    row.second_reading_reference,
    row.gospel_reference,
  ].filter(Boolean);

  return {
    id: `cms-daily-reading-${row.id}`,
    title: `Daily Readings: ${row.celebration || row.reading_date}`,
    description: references.join(" · "),
    type: "daily_reading",
    ...shared,
    startsAt: `${row.reading_date}T06:00:00`,
    endsAt: null,
    location: null,
    ministry: "Liturgy",
    churchId: null,
    visibility: "public",
    workspace: "shared",
    source: "daily_readings",
    href: sourceHref("daily_readings", "member", row.id),
    status: "available",
    metadata: {
      sourceTable: "content_daily_readings",
      gospelReference: row.gospel_reference,
      liturgicalColor: row.liturgical_color,
      season: row.liturgical_season,
    },
  };
}

export function mapAnnouncementRow(row: AnnouncementRow): ParishCalendarEvent {
  const shared = withCategory("announcement");
  const date = row.publish_at ?? row.published_at ?? row.created_at;

  return {
    id: `announcement-${row.id}`,
    title: row.title,
    description: row.content,
    type: "announcement",
    ...shared,
    startsAt: date,
    endsAt: row.expires_at,
    location: null,
    ministry: "Communications",
    churchId: row.church_id,
    visibility: row.audience?.includes("everyone") || row.audience?.includes("members") ? "public" : "admin",
    workspace: row.is_published ? "shared" : "church_admin",
    source: "announcements",
    href: sourceHref("announcements", "church_admin", row.id),
    status: row.status ?? (row.is_published ? "published" : "draft"),
    metadata: {
      sourceTable: "announcements",
      publishedAt: row.published_at,
      publishAt: row.publish_at,
      expiresAt: row.expires_at,
      audience: row.audience,
      category: row.category,
      featured: row.featured,
    },
  };
}

function inferApprovedRequestEventType(row: EventRequestRow): ParishCalendarEventType {
  if (row.request_type === "special_mass_request") return "mass";
  if (row.request_type === "ministry_group_event") return "ministry_meeting";
  if (row.request_type === "prayer_formation_event") return inferEventType(row.title || row.description || "prayer meeting");
  if (row.request_type === "venue_facility_request") return "public_event";
  return inferEventType(row.title || row.description || row.request_type);
}

export function mapApprovedEventRequestRow(row: EventRequestRow): ParishCalendarEvent | null {
  if (row.status !== "approved") return null;
  if (row.converted_event_id || row.converted_mass_event_id) return null;
  if (!row.preferred_date) return null;

  const proposedType = inferApprovedRequestEventType(row);
  const shared = withCategory("custom");
  const ministry = row.ministries?.name ?? null;
  const community = row.communities?.name ?? null;

  return {
    id: `event-request-${row.id}`,
    title: `Approved Request: ${row.title || "Awaiting Scheduling"}`,
    description: row.description,
    type: "custom",
    ...shared,
    startsAt: combineDateAndTime(row.preferred_date, row.preferred_start_time),
    endsAt: row.preferred_end_time ? combineDateAndTime(row.preferred_date, row.preferred_end_time) : null,
    location: row.location_preference,
    ministry,
    community,
    churchId: row.church_id,
    visibility: "member",
    audienceMode: "specific_groups",
    audienceTargets: [],
    workspace: "member",
    source: "event_requests",
    href: sourceHref("event_requests", "member", row.id),
    status: "Approved / Awaiting Scheduling",
    metadata: {
      sourceTable: "event_requests",
      requestId: row.id,
      requestType: row.request_type,
      proposedEventType: proposedType,
      requesterMemberId: row.member_id,
      personalApprovedRequest: true,
      recurrenceExpanded: false,
    },
  };
}

export function expandRecurringMasses(rule: RecurringMassRule, from: Date, to: Date): ParishCalendarEvent[] {
  const startsOn = startOfDay(new Date(`${rule.startsOn}T00:00:00`));
  const endsOn = rule.endsOn ? startOfDay(new Date(`${rule.endsOn}T00:00:00`)) : to;
  const first = startsOn > from ? startsOn : startOfDay(from);
  const last = endsOn < to ? endsOn : to;
  const events: ParishCalendarEvent[] = [];

  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) {
    if (!rule.weekdays.includes(cursor.getDay())) continue;
    const day = dateKey(cursor);
    const shared = withCategory("mass");

    events.push({
      id: `recurring-mass-${rule.id}-${day}`,
      title: rule.title,
      description: rule.description,
      type: "mass",
      ...shared,
      startsAt: combineDateAndTime(day, rule.startTime),
      endsAt: rule.endTime ? combineDateAndTime(day, rule.endTime) : null,
      location: rule.location,
      ministry: "Liturgy",
      churchId: rule.churchId,
      visibility: "public",
      workspace: "pastoral",
      source: "generated",
      href: sourceHref("mass_events", "pastoral", rule.id),
      status: "scheduled",
      metadata: {
        recurringRuleId: rule.id,
        recurrence: "weekly",
      },
    });
  }

  return events;
}

export function dedupeCalendarEvents(events: ParishCalendarEvent[]) {
  const priority = new Map<string, number>([
    ["mass_events", 5],
    ["mass_intentions", 4],
    ["events", 3],
    ["generated", 3],
    ["event_requests", 2.5],
    ["daily_readings", 2],
    ["liturgical_calendar", 1],
  ]);

  const map = new Map<string, ParishCalendarEvent>();
  events.forEach((event) => {
    const key = [event.title.toLowerCase(), dateKey(event.startsAt), event.type, event.churchId ?? "global"].join("|");
    const existing = map.get(key);
    if (!existing || (priority.get(event.source) ?? 0) > (priority.get(existing.source) ?? 0)) {
      map.set(key, event);
    }
  });

  return Array.from(map.values());
}

function groupEventAudienceTargets(rows: EventAudienceTargetRow[]) {
  const map = new Map<string, ParishEventAudienceTarget[]>();

  rows.forEach((row) => {
    const target = row.ministry_id
      ? {
          type: "ministry" as const,
          id: row.ministry_id,
          name: row.ministries?.name || "Ministry",
        }
      : row.community_id
        ? {
            type: "community" as const,
            id: row.community_id,
            name: row.communities?.name || "Community",
          }
        : null;

    if (!target) return;
    map.set(row.event_id, [...(map.get(row.event_id) ?? []), target]);
  });

  return map;
}

export async function fetchParishCalendarFeed({
  churchId,
  workspace,
  from = addDays(startOfDay(new Date()), -45),
  to = addDays(startOfDay(new Date()), 120),
}: ParishCalendarFeedInput): Promise<ParishCalendarEvent[]> {
  const fromKey = dateKey(from);
  const toKey = dateKey(to);

  const [eventsResult, massesResult, intentionsResult, liturgyResult, cmsReadingsResult, announcementsResult, approvedRequestsResult, sacramentsResult] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("church_id", churchId)
      .is("archived_at", null)
      .lte("start_date", to.toISOString())
      .or(`start_date.gte.${from.toISOString()},recurrence_frequency.neq.none`)
      .order("start_date", { ascending: true }),
    supabase
      .from("mass_events" as never)
      .select("*")
      .eq("church_id", churchId)
      .eq("is_active", true)
      .gte("mass_date", fromKey)
      .lte("mass_date", toKey)
      .order("mass_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("mass_intentions" as never)
      .select("id,church_id,intention_type,message,status,mass_date,mass_time,mass_name,created_at")
      .eq("church_id", churchId)
      .gte("mass_date", fromKey)
      .lte("mass_date", toKey)
      .order("mass_date", { ascending: true }),
    supabase
      .from("liturgical_days" as never)
      .select(
        "id,date,celebration,season,liturgical_color,rank,daily_readings(id,first_reading_reference,responsorial_psalm_reference,second_reading_reference,gospel_reference)",
      )
      .gte("date", fromKey)
      .lte("date", toKey)
      .order("date", { ascending: true }),
    supabase
      .from("content_daily_readings" as never)
      .select("id,reading_date,celebration,liturgical_season,liturgical_color,first_reading_reference,responsorial_psalm_reference,second_reading_reference,gospel_reference,status,visibility")
      .gte("reading_date", fromKey)
      .lte("reading_date", toKey)
      .in("status", ["published", "featured"] as never)
      .in("visibility", ["public", "member"] as never)
      .order("reading_date", { ascending: true }),
    supabase
      .from("announcements")
      .select("*")
      .eq("church_id", churchId)
      .is("archived_at", null)
      .eq("show_on_calendar", true)
      .eq("is_published", true)
      .or(`publish_at.is.null,publish_at.lte.${to.toISOString()}`)
      .or(`never_expires.eq.true,expires_at.is.null,expires_at.gte.${from.toISOString()}`)
      .order("publish_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(30),
    workspace === "member"
      ? supabase
          .from("event_requests")
          .select("id,church_id,member_id,title,description,request_type,status,preferred_date,preferred_start_time,preferred_end_time,location_preference,ministry_id,community_id,converted_event_id,converted_mass_event_id,created_at,ministries(name),communities(name)")
          .eq("church_id", churchId)
          .eq("status", "approved")
          .is("converted_event_id", null)
          .is("converted_mass_event_id", null)
          .gte("preferred_date", fromKey)
          .lte("preferred_date", toKey)
          .order("preferred_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("get_sacramental_records" as never, {
      _church_id: churchId,
      _search: null,
    } as never),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (massesResult.error) throw massesResult.error;
  if (intentionsResult.error) throw intentionsResult.error;
  if (liturgyResult.error) throw liturgyResult.error;
  if (cmsReadingsResult.error) throw cmsReadingsResult.error;
  if (announcementsResult.error) throw announcementsResult.error;
  if (approvedRequestsResult.error) throw approvedRequestsResult.error;
  if (sacramentsResult.error) throw sacramentsResult.error;

  const eventRows = (eventsResult.data ?? []) as EventRow[];
  const eventIds = eventRows.map((event) => event.id);
  const audienceTargetsResult = eventIds.length
    ? await supabase
        .from("event_audience_targets" as never)
        .select("event_id,ministry_id,community_id,ministries(name),communities(name)")
        .in("event_id", eventIds as never)
    : { data: [], error: null };

  if (audienceTargetsResult.error) throw audienceTargetsResult.error;

  const audienceTargetsByEvent = groupEventAudienceTargets((audienceTargetsResult.data ?? []) as unknown as EventAudienceTargetRow[]);
  const liturgicalRows = (liturgyResult.data ?? []) as unknown as LiturgicalDayRow[];
  const sacramentalEvents = ((sacramentsResult.data ?? []) as unknown as SacramentalRecord[])
    .filter((record) => {
      if (!record.sacrament_date) return false;
      const date = new Date(record.sacrament_date);
      return date >= from && date <= to;
    })
    .map(mapSacramentToCalendarEvent)
    .filter((event): event is ParishCalendarEvent => Boolean(event));
  const feed = [
    ...eventRows.flatMap((row) => expandParishEventRow(row, from, to, audienceTargetsByEvent.get(row.id) ?? [])),
    ...((massesResult.data ?? []) as unknown as MassEventRow[]).map(mapMassEventRow),
    ...((intentionsResult.data ?? []) as unknown as MassIntentionRow[]).filter((row) => row.mass_date).map(mapMassIntentionRow),
    ...liturgicalRows.map(mapLiturgicalDay),
    ...liturgicalRows.map(mapDailyReading).filter((event): event is ParishCalendarEvent => Boolean(event)),
    ...((cmsReadingsResult.data ?? []) as unknown as CmsDailyReadingRow[]).map(mapCmsDailyReading).filter((event): event is ParishCalendarEvent => Boolean(event)),
    ...((announcementsResult.data ?? []) as AnnouncementRow[]).map(mapAnnouncementRow),
    ...((approvedRequestsResult.data ?? []) as unknown as EventRequestRow[]).map(mapApprovedEventRequestRow).filter((event): event is ParishCalendarEvent => Boolean(event)),
    ...sacramentalEvents,
  ];

  return dedupeCalendarEvents(feed)
    .map((event) => {
      const parentEventId = typeof event.metadata?.parentEventId === "string" ? event.metadata.parentEventId : null;
      return {
        ...event,
        href: event.source === "generated" && parentEventId
          ? sourceHref("events", workspace, parentEventId)
          : sourceHref(event.source, workspace, event.id),
      };
    })
    .filter((event) => {
      if (workspace === "finance") return event.category !== "prayer" && event.visibility !== "pastoral";
      return true;
    });
}
