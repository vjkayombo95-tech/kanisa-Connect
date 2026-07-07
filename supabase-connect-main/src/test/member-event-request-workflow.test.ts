import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("RC-2.7.8 member event request workflow", () => {
  const memberPage = read("src/pages/portal/EventRequests.tsx");
  const adminPage = read("src/pages/church-admin/EventRequestsPage.tsx");
  const eventsPage = read("src/pages/church-admin/EventsPage.tsx");
  const massSchedulePage = read("src/pages/church-admin/MassSchedulePage.tsx");
  const registry = read("src/components/workspace/registry.ts");
  const migration = read("supabase/migrations/20260704133000_member_event_request_workflow.sql");
  const en = JSON.parse(read("src/locales/en.json"));
  const sw = JSON.parse(read("src/locales/sw.json"));

  it("exposes the existing member route in workspace navigation", () => {
    expect(registry).toContain('id: "event-requests"');
    expect(registry).toContain('to: "/portal/event-requests"');
    expect(registry).toContain('featureFlag: "event_requests"');
  });

  it("uses stable request identifiers instead of localized labels", () => {
    for (const requestType of [
      "parish_event",
      "ministry_group_event",
      "special_mass_request",
      "venue_facility_request",
      "prayer_formation_event",
      "other",
    ]) {
      expect(memberPage).toContain(requestType);
      expect(migration).toContain(requestType);
      expect(en.event_request.types[requestType]).toBeTruthy();
      expect(sw.event_request.types[requestType]).toBeTruthy();
    }
  });

  it("keeps member submission as a review request, not an automatic event or Mass", () => {
    expect(memberPage).toContain('.from("event_requests").insert');
    expect(memberPage).not.toContain('.from("events").insert');
    expect(memberPage).not.toContain('.from("mass_events").insert');
    expect(memberPage).not.toContain('.from("mass_intentions").insert');
    expect(memberPage).toContain("status: \"submitted\"");
  });

  it("supports admin review actions with required notes for changes and rejection", () => {
    expect(adminPage).toContain('status: "under_review"');
    expect(adminPage).toContain('status: "approved"');
    expect(adminPage).toContain('status: "changes_requested"');
    expect(adminPage).toContain('status: "rejected"');
    expect(adminPage).toContain("requireNote: true");
    expect(adminPage).toContain("admin_notes");
  });

  it("routes approved conversion through existing Events and Mass Schedule surfaces", () => {
    expect(adminPage).toContain("/church-admin/events?");
    expect(adminPage).toContain("/church-admin/mass-schedule?");
    expect(adminPage).toContain("special_mass_request");
    expect(adminPage).not.toContain("/church-admin/mass-intentions");
    expect(eventsPage).toContain("converted_event_id");
    expect(eventsPage).toContain("eventRequestId");
    expect(massSchedulePage).toContain("converted_mass_event_id");
    expect(massSchedulePage).toContain("mass_events");
    expect(massSchedulePage).not.toContain("mass_intentions");
  });

  it("hardens RLS for own-member and same-church admin access", () => {
    expect(migration).toContain('create policy "Members can read own event requests"');
    expect(migration).toContain('create policy "Members can create own event requests"');
    expect(migration).toContain('create policy "Church managers can read event requests"');
    expect(migration).toContain('create policy "Church managers can review event requests"');
    expect(migration).toContain("public.can_manage_church_roles(auth.uid(), church_id)");
    expect(migration).toContain("reviewed_by is null");
    expect(migration).toContain("converted_event_id is null");
    expect(migration).toContain("converted_mass_event_id is null");
  });

  it("documents the workflow and Mass Request versus Mass Intention boundary", () => {
    const docs = read("docs/MEMBER_EVENT_REQUEST_WORKFLOW.md");
    expect(docs).toContain("Member route: `/portal/event-requests`");
    expect(docs).toContain("Mass Intentions remain separate");
    expect(docs).toContain("Submission does not publish an event");
    expect(docs).toContain("existing `mass_events` Mass Schedule workflow");
  });
});
