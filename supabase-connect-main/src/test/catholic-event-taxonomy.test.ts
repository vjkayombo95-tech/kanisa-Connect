import { describe, expect, it } from "vitest";

import {
  applyCatholicEventDefaults,
  catholicEventTaxonomy,
  catholicEventTaxonomyGroups,
  findCatholicEventType,
  findCatholicEventTypeForPrompt,
} from "@/lib/calendar/catholic-event-taxonomy";
import {
  emptyParishCalendarFilters,
  filterParishCalendarEvents,
  getCalendarServiceOptions,
  inferEventType,
} from "@/components/calendar/calendarUtils";
import type { ParishCalendarEvent } from "@/components/calendar/types";
import { answerKanisaAIConversation, createKanisaAIContext } from "@/lib/ai";
import type { WorkspaceId } from "@/components/workspace";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const baseEvent: ParishCalendarEvent = {
  id: "event-1",
  title: "Parish event",
  type: "public_event",
  category: "community",
  startsAt: "2026-07-10T07:00:00+03:00",
  visibility: "public",
  workspace: "member",
  source: "events",
};

function queryClientWith(rows: Array<[unknown[], unknown]>) {
  return {
    getQueriesData({ queryKey }: { queryKey: unknown[] }) {
      return rows.filter(([key]) => queryKey.every((part, index) => Object.is((key as unknown[])[index], part)));
    },
  } as never;
}

function context(workspace: WorkspaceId, events: ParishCalendarEvent[] = []) {
  return createKanisaAIContext({
    workspace,
    role: workspace === "member" ? "member" as never : workspace as never,
    church: { id: "church-1" },
    tenant: { id: "church-1" },
    route: `/${workspace}`,
    queryClient: queryClientWith([[["parish-calendar-events", "church-1", workspace], events]]),
  });
}

describe("Catholic event taxonomy", () => {
  it("uses stable unique identifiers with English and Kiswahili labels", () => {
    const ids = catholicEventTaxonomy.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["mass", "confession", "baptism", "wedding", "confirmation", "first_communion", "anointing_of_sick"]));
    expect(en.member_portal.parish_life.event_types.confession).toBeTruthy();
    expect(sw.member_portal.parish_life.event_types.confession).toBeTruthy();
  });

  it("groups taxonomy entries by Catholic event category", () => {
    expect(catholicEventTaxonomyGroups.map((group) => group.id)).toEqual([
      "liturgy",
      "sacramental_life",
      "formation",
      "parish_life",
      "ministry",
      "community",
      "other",
    ]);
    expect(catholicEventTaxonomy.some((item) => item.groupId === "sacramental_life" && item.id === "confession")).toBe(true);
  });

  it("applies safe defaults for smart event creation", () => {
    expect(applyCatholicEventDefaults("confession")).toMatchObject({
      eventType: "confession",
      ministry: "Sacramental Life",
      visibility: "public",
    });
    expect(applyCatholicEventDefaults("mass")).toMatchObject({
      eventType: "mass",
      ministry: "Liturgy",
      visibility: "public",
    });
    expect(applyCatholicEventDefaults("custom")).toMatchObject({
      eventType: "custom",
      ministry: "Parish Life",
      visibility: "member",
    });
  });

  it("keeps legacy and localized event type inference safe", () => {
    expect(inferEventType("maungamo ya jumamosi")).toBe("confession");
    expect(inferEventType("first_communion")).toBe("first_communion");
    expect(inferEventType("unknown parish celebration")).toBe("public_event");
    expect(findCatholicEventType("unknown")?.id).toBe("custom");
  });

  it("makes sacramental and ministry events discoverable without exposing records", () => {
    const events: ParishCalendarEvent[] = [
      { ...baseEvent, id: "confession", title: "Saturday Confession", type: "confession", category: "prayer", ministry: "Sacramental Life" },
      { ...baseEvent, id: "baptism", title: "Baptism Preparation", type: "baptism", category: "prayer", ministry: "Sacramental Life" },
      { ...baseEvent, id: "wedding", title: "Wedding Celebration", type: "wedding", category: "prayer", ministry: "Sacramental Life" },
      { ...baseEvent, id: "choir", title: "Choir Practice", type: "choir_practice", category: "ministry", ministry: "Choir" },
      { ...baseEvent, id: "community", title: "Jumuiya Meeting", type: "community_meeting", category: "community", ministry: "St. Monica Jumuiya", community: "St. Monica Jumuiya" },
    ];

    expect(filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, eventType: "confession" }, "member").map((event) => event.id)).toEqual(["confession"]);
    expect(filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, eventType: "baptism" }, "member").map((event) => event.id)).toEqual(["baptism"]);
    expect(filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, eventType: "wedding" }, "member").map((event) => event.id)).toEqual(["wedding"]);
    expect(filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, ministry: "Choir" }, "member").map((event) => event.id)).toEqual(["choir"]);
    expect(filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, community: "St. Monica Jumuiya" }, "member").map((event) => event.id)).toEqual(["community"]);
    expect(getCalendarServiceOptions(events).map((option) => option.value)).toEqual(["Choir", "Sacramental Life", "St. Monica Jumuiya"]);
  });

  it("separates sacramental calendar events from confidential sacramental records", () => {
    const baptism = findCatholicEventType("baptism");
    expect(baptism?.sacramentalClassification).toBe("baptism");
    expect(baptism?.aliases).toContain("ubatizo");
    expect(applyCatholicEventDefaults("baptism")).not.toHaveProperty("certificateNumber");
  });

  it("routes English and Kiswahili service questions to authorized calendar events", () => {
    const events: ParishCalendarEvent[] = [
      { ...baseEvent, id: "confession", title: "Saturday Confession", type: "confession", category: "prayer", ministry: "Sacramental Life" },
      { ...baseEvent, id: "mass", title: "Morning Mass", type: "mass", category: "mass", ministry: "Liturgy" },
    ];

    expect(findCatholicEventTypeForPrompt("Maungamo ni lini?")?.id).toBe("confession");
    expect(answerKanisaAIConversation("Maungamo ni lini?", context("member", events)).sections[0].items?.[0].title).toBe("Saturday Confession");
    expect(answerKanisaAIConversation("When is the next Mass?", context("member", events)).sections[0].items?.[0].title).toBe("Morning Mass");
    expect(answerKanisaAIConversation("Are there baptism events?", context("member", events)).status).toBe("empty");
  });
});
