import { readFileSync } from "node:fs";
import path from "node:path";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChurchDashboardExperience } from "@/components/church-admin/ChurchDashboardExperience";
import { ChurchDashboardMobileExperience } from "@/components/church-admin/ChurchDashboardMobileExperience";
import { changeAppLanguage } from "@/i18n";
import {
  combineTodaySchedule,
  getTanzaniaDateKey,
  getTanzaniaTimestampBounds,
  type TodayScheduleItem,
} from "@/lib/church-dashboard-today-schedule";
import { EMPTY_FINANCIAL_SUMMARY, EMPTY_PENDING_COUNTS } from "@/lib/church-dashboard-intelligence";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

vi.mock("@/components/staff-mobile/StaffMobileExperience", () => ({
  useVisibleStaffServices: () => ({ services: [], isLoading: false }),
}));

let host: HTMLDivElement;
let root: Root;

const scheduleItems: TodayScheduleItem[] = [
  {
    id: "mass-occurrence-morning",
    source: "mass_occurrence",
    title: "Morning Mass",
    time: "06:30",
    location: "Main Church",
    status: "scheduled",
    eventType: null,
    sortKey: "06:30:0:morning",
  },
  {
    id: "mass-occurrence-confession",
    source: "mass_occurrence",
    title: "Confession",
    time: "17:00",
    location: "Confessional",
    status: "scheduled",
    eventType: null,
    sortKey: "17:00:0:confession",
  },
  {
    id: "event-youth",
    source: "event",
    title: "Youth Fellowship",
    time: "19:00",
    location: "Hall",
    status: "Youth",
    eventType: "Youth",
    sortKey: "19:00:1:youth",
  },
];

const intelligence = {
  pending: { data: EMPTY_PENDING_COUNTS, isLoading: false, isError: false },
  pendingEnabled: true,
  financial: { data: EMPTY_FINANCIAL_SUMMARY, isLoading: false, isError: false },
  financialEnabled: false,
  staffWorkspace: "admin",
} as never;

function render(node: ReactNode) {
  act(() => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
}

function text() {
  return host.textContent ?? "";
}

describe("Church Admin Dashboard today's schedule", () => {
  beforeEach(async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await changeAppLanguage("en");
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  it("uses Tanzania dates and day boundaries for today's dashboard schedule", () => {
    expect(getTanzaniaDateKey(new Date("2026-09-26T20:59:00.000Z"))).toBe("2026-09-26");
    expect(getTanzaniaDateKey(new Date("2026-09-26T21:01:00.000Z"))).toBe("2026-09-27");
    expect(getTanzaniaTimestampBounds("2026-09-27")).toEqual({
      start: "2026-09-27T00:00:00",
      end: "2026-09-28T00:00:00",
    });
  });

  it("combines and sorts Mass, Confession, and same-day events without inferring types from names", () => {
    const combined = combineTodaySchedule({
      occurrences: [
        { id: "confession", church_id: "church-1", occurrence_date: "2026-09-27", start_time: "17:00", name: "Confession", location_name: "Confessional", status: "scheduled" },
        { id: "mass", church_id: "church-1", occurrence_date: "2026-09-27", start_time: "06:30", name: "Morning Mass", location_name: "Main Church", status: "scheduled" },
      ],
      events: [
        { id: "event", church_id: "church-1", title: "Youth Fellowship", start_date: "2026-09-27T19:00:00", location: "Hall", event_type: "Youth", archived_at: null },
      ],
    });

    expect(combined.map((item) => item.title)).toEqual(["Morning Mass", "Confession", "Youth Fellowship"]);
    expect(combined[1]).toMatchObject({ title: "Confession", eventType: null, source: "mass_occurrence" });
    expect(combined[2]).toMatchObject({ title: "Youth Fellowship", eventType: "Youth", source: "event" });
  });

  it("keeps dashboard reads tenant-scoped, same-day bounded, and preserves RSVP summary", () => {
    const dashboard = read("src/pages/church-admin/ChurchDashboard.tsx");

    expect(dashboard).toContain('.from("mass_occurrences")');
    expect(dashboard).toContain('.eq("church_id", churchId)');
    expect(dashboard).toContain('.eq("occurrence_date", todayKey)');
    expect(dashboard).toContain('.in("status", ["scheduled", "rescheduled"])');
    expect(dashboard).toContain('.from("events")');
    expect(dashboard).toContain('.gte("start_date", todayBounds.start)');
    expect(dashboard).toContain('.lt("start_date", todayBounds.end)');
    expect(dashboard).toContain('.is("archived_at", null)');
    expect(dashboard).toContain('supabase.rpc("get_next_mass_summary"');
  });

  it("renders desktop today's schedule entries before the neutral empty state", () => {
    render(
      <ChurchDashboardExperience
        userRole="church_admin"
        intelligence={intelligence}
        administratorName="Amina Admin"
        greeting="Good morning"
        churchName="St. Joseph"
        bannerUrl={null}
        bannerPositionY={38}
        activeMembers={10}
        totalMembers={12}
        announcementCount={0}
        upcomingEventCount={1}
        attendance={{ title: "Sunday Mass", yes: 5, maybe: 1, responseRate: 50 }}
        todaySchedule={scheduleItems}
        todayScheduleError={false}
        recentActivity={[]}
        criticalLoading={false}
        deferredLoading={false}
      />,
    );

    expect(text()).toContain("Morning Mass");
    expect(text()).toContain("Confession");
    expect(text()).toContain("Youth Fellowship");
    expect(text()).not.toContain("No next Mass is scheduled right now.");
    expect(text()).toContain("Confirmed");
  });

  it("renders a neutral desktop empty and error state for today's schedule", () => {
    render(
      <ChurchDashboardExperience
        userRole="church_admin"
        intelligence={intelligence}
        administratorName="Amina Admin"
        greeting="Good morning"
        churchName="St. Joseph"
        bannerUrl={null}
        bannerPositionY={38}
        activeMembers={10}
        totalMembers={12}
        announcementCount={0}
        upcomingEventCount={0}
        attendance={{ title: null, yes: 0, maybe: 0, responseRate: 0 }}
        todaySchedule={[]}
        todayScheduleError={false}
        recentActivity={[]}
        criticalLoading={false}
        deferredLoading={false}
      />,
    );
    expect(text()).toContain("No scheduled activity is listed for today.");
    expect(text()).not.toContain("No next Mass is scheduled right now.");

    render(
      <ChurchDashboardExperience
        userRole="church_admin"
        intelligence={intelligence}
        administratorName="Amina Admin"
        greeting="Good morning"
        churchName="St. Joseph"
        bannerUrl={null}
        bannerPositionY={38}
        activeMembers={10}
        totalMembers={12}
        announcementCount={0}
        upcomingEventCount={0}
        attendance={{ title: null, yes: 0, maybe: 0, responseRate: 0 }}
        todaySchedule={[]}
        todayScheduleError
        recentActivity={[]}
        criticalLoading={false}
        deferredLoading={false}
      />,
    );
    expect(text()).toContain("Today's schedule is temporarily unavailable.");
  });

  it("uses today's schedule in the mobile focus and snapshot", () => {
    render(
      <ChurchDashboardMobileExperience
        config={{
          workspace: "admin",
          home: "/church-admin",
          workLabel: "Dashboard",
          workLabelKey: "dashboard",
          workRoute: "/church-admin",
          servicesRoute: "/church-admin",
          services: [],
        }}
        intelligence={intelligence}
        administratorName="Amina Admin"
        greeting="Good morning"
        churchName="St. Joseph"
        bannerUrl={null}
        bannerPositionY={38}
        activeMembers={10}
        totalMembers={12}
        announcementCount={0}
        upcomingEventCount={1}
        attendance={{ title: "Sunday Mass", yes: 5, maybe: 1, responseRate: 50 }}
        todaySchedule={scheduleItems}
        todayScheduleError={false}
        criticalLoading={false}
        criticalError={false}
        deferredLoading={false}
        deferredError={false}
      />,
    );

    expect(text()).toContain("Morning Mass is scheduled today at 06:30.");
    expect(text()).toContain("Today's schedule has 3 items, starting with Morning Mass.");
    expect(text()).toContain("Today's schedule");
  });
});
