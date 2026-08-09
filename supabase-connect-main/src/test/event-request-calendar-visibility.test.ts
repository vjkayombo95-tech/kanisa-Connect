import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { answerKanisaAIConversation, createKanisaAIContext } from "@/lib/ai";
import { expandParishEventRow, mapApprovedEventRequestRow } from "@/lib/calendar/engine";
import type { ParishCalendarEvent } from "@/components/calendar/types";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    church_id: "church-1",
    member_id: "member-1",
    title: "Youth Retreat",
    description: "Youth retreat proposal",
    request_type: "ministry_group_event",
    status: "approved",
    preferred_date: "2026-07-20",
    preferred_start_time: "09:00",
    preferred_end_time: "15:00",
    location_preference: "Parish hall",
    ministry_id: "youth-ministry",
    community_id: null,
    converted_event_id: null,
    converted_mass_event_id: null,
    created_at: "2026-07-05T08:00:00",
    ministries: { name: "Youth Ministry" },
    communities: null,
    ...overrides,
  };
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    church_id: "church-1",
    title: "Youth Retreat",
    description: null,
    start_date: "2026-07-20T09:00:00",
    end_date: "2026-07-20T15:00:00",
    location: "Parish hall",
    status: "upcoming",
    archived_at: null,
    event_type: "retreat",
    ministry: "Youth Ministry",
    visibility: "member",
    audience_mode: "specific_groups",
    recurrence_frequency: "none",
    recurrence_interval: 1,
    recurrence_days_of_week: null,
    recurrence_end_date: null,
    recurrence_count: null,
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

describe("RC-2.7.9 event request calendar visibility correction", () => {
  it("keeps draft, submitted, under-review, changes-requested, rejected, and cancelled requests off calendar", () => {
    for (const status of ["draft", "submitted", "under_review", "changes_requested", "rejected", "cancelled"]) {
      expect(mapApprovedEventRequestRow(requestRow({ status }))).toBeNull();
    }
  });

  it("shows approved unconverted request as one requester-only personal marker", () => {
    const marker = mapApprovedEventRequestRow(requestRow());
    expect(marker).toMatchObject({
      id: "event-request-request-1",
      source: "event_requests",
      visibility: "member",
      workspace: "member",
      status: "Approved / Awaiting Scheduling",
      title: "Approved Request: Youth Retreat",
      type: "custom",
    });
    expect(marker?.metadata?.personalApprovedRequest).toBe(true);
    expect(marker?.metadata?.recurrenceExpanded).toBe(false);
  });

  it("removes the personal marker after Event or Mass conversion", () => {
    expect(mapApprovedEventRequestRow(requestRow({ converted_event_id: "event-1" }))).toBeNull();
    expect(mapApprovedEventRequestRow(requestRow({ converted_mass_event_id: "mass-1" }))).toBeNull();
  });

  it("does not expand recurrence from an approved proposal", () => {
    const marker = mapApprovedEventRequestRow(requestRow({ title: "Weekly Choir Rehearsal" }));
    expect(marker ? [marker] : []).toHaveLength(1);
    expect(marker?.source).toBe("event_requests");
    expect(marker?.metadata?.recurrenceExpanded).toBe(false);
  });

  it("starts recurrence only after conversion into a real recurring Event", () => {
    const occurrences = expandParishEventRow(
      eventRow({
        recurrence_frequency: "weekly",
        recurrence_days_of_week: [1],
        recurrence_count: 3,
      }),
      new Date("2026-07-01T00:00:00"),
      new Date("2026-08-01T00:00:00"),
      [{ type: "ministry", id: "youth-ministry", name: "Youth Ministry" }],
    );

    expect(occurrences.length).toBeGreaterThan(1);
    expect(occurrences.every((event) => event.source === "generated")).toBe(true);
    expect(occurrences.every((event) => event.audienceMode === "specific_groups")).toBe(true);
  });

  it("keeps request ownership from bypassing final Event audience rules", () => {
    const convertedEvent = expandParishEventRow(
      eventRow({ audience_mode: "specific_groups" }),
      new Date("2026-07-01T00:00:00"),
      new Date("2026-08-01T00:00:00"),
      [{ type: "ministry", id: "youth-ministry", name: "Youth Ministry" }],
    )[0];

    expect(convertedEvent.source).toBe("events");
    expect(convertedEvent.audienceMode).toBe("specific_groups");
    expect(convertedEvent.audienceTargets?.[0]?.id).toBe("youth-ministry");
    expect(convertedEvent.metadata?.requesterMemberId).toBeUndefined();
  });

  it("prevents Kanisa AI from treating unapproved requests as upcoming calendar events", () => {
    const response = answerKanisaAIConversation(
      "What events are coming up?",
      createKanisaAIContext({
        workspace: "member",
        role: "member" as never,
        church: { id: "church-1" },
        tenant: { id: "church-1" },
        route: "/portal/calendar",
        queryClient: queryClientWith([]),
      }),
    );

    expect(response.status).toBe("empty");
  });

  it("allows Kanisa AI to include the requester approved marker but not duplicate it after conversion", () => {
    const approvedMarker = mapApprovedEventRequestRow(requestRow());
    const approvedResponse = answerKanisaAIConversation(
      "Show my calendar",
      createKanisaAIContext({
        workspace: "member",
        role: "member" as never,
        church: { id: "church-1" },
        tenant: { id: "church-1" },
        route: "/portal/calendar",
        queryClient: queryClientWith(approvedMarker ? [approvedMarker] : []),
      }),
    );

    const convertedEvent = expandParishEventRow(eventRow(), new Date("2026-07-01T00:00:00"), new Date("2026-08-01T00:00:00"))[0];
    const convertedResponse = answerKanisaAIConversation(
      "Show my calendar",
      createKanisaAIContext({
        workspace: "member",
        role: "member" as never,
        church: { id: "church-1" },
        tenant: { id: "church-1" },
        route: "/portal/calendar",
        queryClient: queryClientWith([convertedEvent]),
      }),
    );

    expect(approvedResponse.sections[0].items?.[0].title).toContain("Approved Request");
    expect(convertedResponse.sections[0].items).toHaveLength(1);
    expect(convertedResponse.sections[0].items?.[0].title).toBe("Youth Retreat");
  });

  it("fetches approved unconverted requests only for member calendar feed", () => {
    const engine = read("src/lib/calendar/engine.ts");
    expect(engine).toContain('workspace === "member"');
    expect(engine).toContain('.from("event_requests")');
    expect(engine).toContain('.eq("status", "approved")');
    expect(engine).toContain('.is("converted_event_id", null)');
    expect(engine).toContain('.is("converted_mass_event_id", null)');
    expect(engine).not.toContain('.in("status", ["submitted", "under_review"]');
  });
});
