import { describe, expect, it } from "vitest";

import {
  emptyParishCalendarFilters,
  filterParishCalendarEvents,
  getAuthorizedCalendarVisibilityOptions,
  getAuthorizedCalendarWorkspaceOptions,
  getCalendarServiceOptions,
  sanitizeParishCalendarFilters,
  shouldShowCalendarWorkspaceFilter,
} from "@/components/calendar/calendarUtils";
import type { ParishCalendarEvent } from "@/components/calendar/types";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const baseEvent: ParishCalendarEvent = {
  id: "event-1",
  title: "Visible event",
  type: "public_event",
  category: "community",
  startsAt: "2026-07-10T07:00:00+03:00",
  visibility: "public",
  workspace: "shared",
  source: "events",
};

function workspaceOptionValues(workspace: Parameters<typeof getAuthorizedCalendarWorkspaceOptions>[0]) {
  return getAuthorizedCalendarWorkspaceOptions(workspace).map((item) => item.value);
}

describe("Parish Calendar workspace scope filters", () => {
  it("does not give Member admin, finance, pastoral, or platform workspace options", () => {
    expect(workspaceOptionValues("member")).toEqual(["member"]);
    expect(workspaceOptionValues("member")).not.toContain("church_admin");
    expect(workspaceOptionValues("member")).not.toContain("finance");
    expect(workspaceOptionValues("member")).not.toContain("pastoral");
    expect(workspaceOptionValues("member")).not.toContain("super_admin");
    expect(shouldShowCalendarWorkspaceFilter("member")).toBe(false);
  });

  it("treats View As Member as Member calendar scope", () => {
    const sanitized = sanitizeParishCalendarFilters(
      { ...emptyParishCalendarFilters, workspace: "church_admin", visibility: "admin" },
      "member",
    );

    expect(sanitized.workspace).toBe("all");
    expect(sanitized.visibility).toBe("all");
    expect(shouldShowCalendarWorkspaceFilter("member")).toBe(false);
  });

  it("keeps Church Admin parish scopes but excludes Super Admin platform scope", () => {
    expect(workspaceOptionValues("church_admin")).toEqual(["member", "pastoral", "church_admin", "finance"]);
    expect(workspaceOptionValues("church_admin")).not.toContain("super_admin");
    expect(shouldShowCalendarWorkspaceFilter("church_admin")).toBe(true);
  });

  it("keeps Finance, Pastoral, and Super Admin workspace filters single-scope", () => {
    expect(workspaceOptionValues("finance")).toEqual(["finance"]);
    expect(workspaceOptionValues("pastoral")).toEqual(["pastoral"]);
    expect(workspaceOptionValues("super_admin")).toEqual(["super_admin"]);
    expect(shouldShowCalendarWorkspaceFilter("finance")).toBe(false);
    expect(shouldShowCalendarWorkspaceFilter("pastoral")).toBe(false);
    expect(shouldShowCalendarWorkspaceFilter("super_admin")).toBe(false);
  });

  it("uses identical authorization semantics regardless of display language", () => {
    const englishValues = workspaceOptionValues("church_admin");
    const swahiliValues = workspaceOptionValues("church_admin");
    expect(swahiliValues).toEqual(englishValues);
    expect(getAuthorizedCalendarVisibilityOptions("member").map((item) => item.value)).toEqual(["public", "member"]);
  });

  it("sanitizes unauthorized saved workspace and visibility filters", () => {
    const memberFilters = sanitizeParishCalendarFilters(
      { ...emptyParishCalendarFilters, workspace: "super_admin", visibility: "finance" },
      "member",
    );
    const adminFilters = sanitizeParishCalendarFilters(
      { ...emptyParishCalendarFilters, workspace: "super_admin", visibility: "admin" },
      "church_admin",
    );

    expect(memberFilters.workspace).toBe("all");
    expect(memberFilters.visibility).toBe("all");
    expect(adminFilters.workspace).toBe("all");
    expect(adminFilters.visibility).toBe("admin");
  });

  it("does not allow a client-side workspace filter to expand authorized Member data", () => {
    const events: ParishCalendarEvent[] = [
      baseEvent,
      {
        ...baseEvent,
        id: "admin-event",
        title: "Admin-only event",
        visibility: "admin",
        workspace: "church_admin",
      },
      {
        ...baseEvent,
        id: "finance-event",
        title: "Finance-only event",
        visibility: "finance",
        workspace: "finance",
      },
    ];

    const filtered = filterParishCalendarEvents(
      events,
      { ...emptyParishCalendarFilters, workspace: "church_admin" },
      "member",
    );

    expect(filtered).toHaveLength(0);
    expect(filtered.map((event) => event.id)).not.toContain("admin-event");
    expect(filtered.map((event) => event.id)).not.toContain("finance-event");
  });

  it("derives Huduma options only from authorized Member-visible events", () => {
    const events: ParishCalendarEvent[] = [
      { ...baseEvent, id: "mass", title: "Morning Mass", type: "mass", category: "mass", ministry: "Liturgy" },
      { ...baseEvent, id: "confession", title: "Confession", type: "confession", category: "prayer", ministry: null },
      { ...baseEvent, id: "baptism", title: "Baptism preparation", type: "baptism", category: "prayer", visibility: "member", ministry: null },
      { ...baseEvent, id: "admin", title: "Admin planning", type: "administration", category: "administration", visibility: "admin", ministry: "Admin Office" },
    ];

    const authorizedMemberEvents = events.filter((event) => filterParishCalendarEvents([event], emptyParishCalendarFilters, "member").length > 0);
    const serviceOptions = getCalendarServiceOptions(authorizedMemberEvents);

    expect(serviceOptions.map((option) => option.value)).toEqual(["event-type:baptism", "event-type:confession", "Liturgy"]);
    expect(serviceOptions.map((option) => option.value)).not.toContain("Admin Office");
  });

  it("narrows and restores authorized Member events through Huduma values", () => {
    const events: ParishCalendarEvent[] = [
      { ...baseEvent, id: "mass", title: "Morning Mass", type: "mass", category: "mass", ministry: "Liturgy" },
      { ...baseEvent, id: "choir", title: "Choir practice", type: "choir_practice", category: "ministry", ministry: "Choir" },
      { ...baseEvent, id: "confession", title: "Confession", type: "confession", category: "prayer", ministry: null },
    ];

    const choirEvents = filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, ministry: "Choir" }, "member");
    const confessionEvents = filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, ministry: "event-type:confession" }, "member");
    const restoredEvents = filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, ministry: "all" }, "member");

    expect(choirEvents.map((event) => event.id)).toEqual(["choir"]);
    expect(confessionEvents.map((event) => event.id)).toEqual(["confession"]);
    expect(restoredEvents).toHaveLength(3);
  });

  it("keeps quick category filters compatible with detailed Huduma filters", () => {
    const events: ParishCalendarEvent[] = [
      { ...baseEvent, id: "mass", title: "Morning Mass", type: "mass", category: "mass", ministry: "Liturgy" },
      { ...baseEvent, id: "choir", title: "Choir practice", type: "choir_practice", category: "ministry", ministry: "Choir" },
      { ...baseEvent, id: "youth", title: "Youth meeting", type: "youth_meeting", category: "ministry", ministry: "Youth" },
    ];

    const ministryQuickFilter = filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, category: "ministry" }, "member");
    const combinedFilter = filterParishCalendarEvents(events, { ...emptyParishCalendarFilters, category: "ministry", ministry: "Youth" }, "member");

    expect(ministryQuickFilter.map((event) => event.id)).toEqual(["choir", "youth"]);
    expect(combinedFilter.map((event) => event.id)).toEqual(["youth"]);
  });

  it("has localized filtered empty-state recovery copy without workspace language", () => {
    expect(en.member_portal.parish_life.no_filtered_items).toBeTruthy();
    expect(sw.member_portal.parish_life.no_filtered_items).toBeTruthy();
    expect(en.member_portal.parish_life.no_scheduled_items_description.toLowerCase()).not.toContain("workspace");
    expect(sw.member_portal.parish_life.no_scheduled_items_description.toLowerCase()).not.toContain("eneo la kazi");
  });
});
