import { describe, expect, it } from "vitest";

import { emptyParishCalendarFilters, filterParishCalendarEvents, getCalendarVisibleRange } from "@/components/calendar/calendarUtils";
import type { ParishCalendarEvent } from "@/components/calendar/types";
import { answerKanisaAIConversation, createKanisaAIContext } from "@/lib/ai";
import { catholicEventTaxonomy, findCatholicEventType } from "@/lib/calendar/catholic-event-taxonomy";
import { dedupeCalendarEvents, expandParishEventRow } from "@/lib/calendar/engine";
import {
  expandRecurringCalendarEvent,
  MAX_RECURRENCE_OCCURRENCES,
  validateRecurrenceRule,
  type CalendarRecurrenceParent,
} from "@/lib/calendar/recurrence";

const baseParent: CalendarRecurrenceParent = {
  id: "stations",
  startsAt: "2026-02-20T18:00:00",
  endsAt: "2026-02-20T19:00:00",
  recurrence: {
    frequency: "weekly",
    interval: 1,
    daysOfWeek: [5],
    count: 6,
  },
};

const from = new Date("2026-02-01T00:00:00");
const to = new Date("2026-05-01T23:59:59");

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "series-1",
    church_id: "church-1",
    title: "Saturday Confession",
    description: null,
    start_date: "2026-07-04T09:00:00",
    end_date: "2026-07-04T10:30:00",
    location: "Confessional",
    status: "upcoming",
    archived_at: null,
    event_type: "confession",
    ministry: "Sacramental Life",
    visibility: "public",
    recurrence_frequency: "weekly",
    recurrence_interval: 1,
    recurrence_days_of_week: [6],
    recurrence_end_date: null,
    recurrence_count: 12,
    recurrence_monthly_pattern: "day_of_month",
    recurrence_monthly_week: null,
    recurrence_monthly_weekday: null,
    ...overrides,
  };
}

function queryClientWith(events: ParishCalendarEvent[]) {
  return {
    getQueriesData({ queryKey }: { queryKey: unknown[] }) {
      const key = ["parish-calendar-events", "church-1", "member"];
      return queryKey.every((part, index) => Object.is(key[index], part)) ? [[key, events]] : [];
    },
  } as never;
}

describe("Recurring Catholic events", () => {
  it("expands daily recurrences by interval and count while preserving duration", () => {
    const occurrences = expandRecurringCalendarEvent(
      {
        ...baseParent,
        id: "daily",
        recurrence: { frequency: "daily", interval: 2, count: 3 },
      },
      from,
      to,
    );

    expect(occurrences.map((event) => event.occurrenceDate)).toEqual(["2026-02-20", "2026-02-22", "2026-02-24"]);
    expect(new Date(occurrences[0].endsAt!).getTime() - new Date(occurrences[0].startsAt).getTime()).toBe(60 * 60 * 1000);
  });

  it("expands weekly Friday Stations of the Cross for six weeks", () => {
    const occurrences = expandRecurringCalendarEvent(baseParent, from, to);

    expect(occurrences).toHaveLength(6);
    expect(occurrences.map((event) => event.occurrenceDate)).toEqual([
      "2026-02-20",
      "2026-02-27",
      "2026-03-06",
      "2026-03-13",
      "2026-03-20",
      "2026-03-27",
    ]);
    expect(occurrences[0].id).toBe("event-stations-2026-02-20");
  });

  it("expands multiple weekdays and every two weeks", () => {
    const occurrences = expandRecurringCalendarEvent(
      {
        ...baseParent,
        recurrence: { frequency: "weekly", interval: 2, daysOfWeek: [1, 3], count: 4 },
      },
      from,
      to,
    );

    expect(occurrences.map((event) => event.occurrenceDate)).toEqual(["2026-02-23", "2026-02-25", "2026-03-09", "2026-03-11"]);
  });

  it("handles monthly counts and clamps day 29, 30, and 31 safely", () => {
    const monthly31 = expandRecurringCalendarEvent(
      {
        id: "month-end",
        startsAt: "2026-01-31T08:00:00",
        endsAt: "2026-01-31T09:00:00",
        recurrence: { frequency: "monthly", interval: 1, count: 3, monthlyPattern: "day_of_month" },
      },
      new Date("2026-01-01T00:00:00"),
      new Date("2026-04-30T23:59:59"),
    );

    expect(monthly31.map((event) => event.occurrenceDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);

    const leap29 = expandRecurringCalendarEvent(
      {
        id: "leap",
        startsAt: "2028-02-29T08:00:00",
        recurrence: { frequency: "monthly", interval: 1, count: 2, monthlyPattern: "day_of_month" },
      },
      new Date("2028-02-01T00:00:00"),
      new Date("2028-04-30T23:59:59"),
    );
    expect(leap29.map((event) => event.occurrenceDate)).toEqual(["2028-02-29", "2028-03-29"]);
  });

  it("supports first Friday monthly patterns", () => {
    const occurrences = expandRecurringCalendarEvent(
      {
        id: "first-friday",
        startsAt: "2026-05-01T18:00:00",
        recurrence: { frequency: "monthly", interval: 1, count: 3, monthlyPattern: "nth_weekday", monthlyWeek: 1, monthlyWeekday: 5 },
      },
      new Date("2026-05-01T00:00:00"),
      new Date("2026-08-31T23:59:59"),
    );

    expect(occurrences.map((event) => event.occurrenceDate)).toEqual(["2026-05-01", "2026-06-05", "2026-07-03"]);
  });

  it("rejects invalid rules and caps generated occurrences", () => {
    expect(validateRecurrenceRule({ ...baseParent, recurrence: { frequency: "weekly", interval: 1, daysOfWeek: [] } })).toContain("recurrence_weekdays_required");
    expect(validateRecurrenceRule({ ...baseParent, recurrence: { frequency: "daily", interval: 0, count: 1 } })).toContain("recurrence_interval_invalid");

    const occurrences = expandRecurringCalendarEvent(
      {
        ...baseParent,
        recurrence: { frequency: "daily", interval: 1, count: 1000 },
      },
      from,
      new Date("2028-02-01T23:59:59"),
    );

    expect(occurrences.length).toBeLessThanOrEqual(MAX_RECURRENCE_OCCURRENCES);
  });

  it("maps public event series into member-visible generated occurrences", () => {
    const events = expandParishEventRow(eventRow(), new Date("2026-07-01T00:00:00"), new Date("2026-08-31T23:59:59"));

    expect(events[0]).toMatchObject({
      id: "event-series-1-2026-07-04",
      type: "confession",
      source: "generated",
      ministry: "Sacramental Life",
      visibility: "public",
    });
    expect(events[0].metadata?.parentEventId).toBe("series-1");
    expect(filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, eventType: "confession" }, "member")).toHaveLength(9);
    expect(filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, ministry: "Sacramental Life" }, "member")).toHaveLength(9);
  });

  it("expands a weekly Sunday Mass from an earlier month into the visible month range", () => {
    const range = getCalendarVisibleRange("month", new Date("2026-07-15T12:00:00"));
    const events = expandParishEventRow(
      eventRow({
        id: "sunday-mass",
        title: "Holy Mass",
        start_date: "2026-01-04T08:00:00",
        end_date: "2026-01-04T09:00:00",
        event_type: "mass",
        ministry: "Liturgy",
        recurrence_days_of_week: [0],
        recurrence_end_date: "2026-07-31",
        recurrence_count: null,
      }),
      range.from,
      range.to,
    );

    const julySundays = events
      .map((event) => event.metadata?.occurrenceDate)
      .filter((date) => typeof date === "string" && date >= "2026-07-01" && date <= "2026-07-31");

    expect(julySundays).toEqual(["2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26"]);
  });

  it("keeps generated occurrence ids unique and dedupe does not collapse a series by parent id", () => {
    const events = expandParishEventRow(eventRow(), new Date("2026-07-01T00:00:00"), new Date("2026-07-31T23:59:59"));
    const ids = events.map((event) => event.id);
    const deduped = dedupeCalendarEvents(events);

    expect(new Set(ids).size).toBe(ids.length);
    expect(deduped).toHaveLength(events.length);
  });

  it("provides the Month View with all expanded occurrences for the visible grid", () => {
    const range = getCalendarVisibleRange("month", new Date("2026-07-15T12:00:00"));
    const events = expandParishEventRow(
      eventRow({
        title: "Bible Study",
        start_date: "2026-07-08T19:00:00",
        end_date: "2026-07-08T20:00:00",
        event_type: "bible_study",
        recurrence_days_of_week: [3],
        recurrence_count: null,
        recurrence_end_date: "2026-07-31",
      }),
      range.from,
      range.to,
    );

    expect(events.map((event) => event.metadata?.occurrenceDate)).toEqual([
      "2026-07-08",
      "2026-07-15",
      "2026-07-22",
      "2026-07-29",
    ]);
  });

  it("preserves parent audience targeting on generated recurring occurrences", () => {
    const events = expandParishEventRow(
      eventRow({
        title: "Choir Rehearsal",
        event_type: "choir_practice",
        ministry: "Choir",
        audience_mode: "specific_groups",
      }),
      new Date("2026-07-01T00:00:00"),
      new Date("2026-07-31T23:59:59"),
      [{ type: "ministry", id: "choir-ministry", name: "Choir" }],
    );

    expect(events).toHaveLength(4);
    expect(events.every((event) => event.audienceMode === "specific_groups")).toBe(true);
    expect(events.every((event) => event.audienceTargets?.[0]?.id === "choir-ministry")).toBe(true);
    expect(events.every((event) => event.metadata?.parentEventId === "series-1")).toBe(true);
  });

  it("lets Kanisa AI answer only from authorized targeted event feed entries", () => {
    const choirEvents = expandParishEventRow(
      eventRow({
        title: "Choir Confession",
        event_type: "confession",
        ministry: "Choir",
        audience_mode: "specific_groups",
      }),
      new Date("2026-07-01T00:00:00"),
      new Date("2026-07-31T23:59:59"),
      [{ type: "ministry", id: "choir-ministry", name: "Choir" }],
    );

    const authorizedResponse = answerKanisaAIConversation(
      "Maungamo ni lini?",
      createKanisaAIContext({
        workspace: "member",
        role: "member" as never,
        church: { id: "church-1" },
        tenant: { id: "church-1" },
        route: "/portal/calendar",
        queryClient: queryClientWith(choirEvents),
      }),
    );

    const unauthorizedResponse = answerKanisaAIConversation(
      "Maungamo ni lini?",
      createKanisaAIContext({
        workspace: "member",
        role: "member" as never,
        church: { id: "church-1" },
        tenant: { id: "church-1" },
        route: "/portal/calendar",
        queryClient: queryClientWith([]),
      }),
    );

    expect(authorizedResponse.sections[0].items?.[0].title).toBe("Choir Confession");
    expect(unauthorizedResponse.status).toBe("empty");
  });

  it("keeps legacy one-time events compatible", () => {
    const events = expandParishEventRow(
      eventRow({
        recurrence_frequency: "none",
        recurrence_days_of_week: null,
        recurrence_count: null,
      }),
      new Date("2026-07-01T00:00:00"),
      new Date("2026-08-31T23:59:59"),
    );

    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("events");
  });

  it("keeps taxonomy recurrence capabilities permissive for parish schedules", () => {
    expect(findCatholicEventType("mass")?.supportsRecurrence).toBe(true);
    expect(findCatholicEventType("confession")?.supportsRecurrence).toBe(true);
    expect(findCatholicEventType("stations_of_the_cross")?.supportsRecurrence).toBe(true);
    expect(findCatholicEventType("baptism")?.supportsRecurrence).toBe(true);
    expect(findCatholicEventType("wedding")?.supportsRecurrence).toBe(false);
    expect(catholicEventTaxonomy.some((item) => item.id === "council_meeting" && item.supportsRecurrence)).toBe(true);
  });

  it("lets Kanisa AI answer from authorized generated occurrences", () => {
    const events = expandParishEventRow(eventRow(), new Date("2026-07-01T00:00:00"), new Date("2026-08-31T23:59:59"));
    const response = answerKanisaAIConversation(
      "Maungamo ni lini?",
      createKanisaAIContext({
        workspace: "member",
        role: "member" as never,
        church: { id: "church-1" },
        tenant: { id: "church-1" },
        route: "/portal/calendar",
        queryClient: queryClientWith(events),
      }),
    );

    expect(response.status).toBe("success");
    expect(response.sections[0].items?.[0].title).toBe("Saturday Confession");
  });
});
