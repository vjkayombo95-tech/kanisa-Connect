import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const calendar = read("src/pages/ParishCalendarPage.tsx");
const serviceRegistry = read("src/lib/member-service-registry.ts");
const portalLayout = read("src/components/portal/PortalLayout.tsx");
const memberMyParish = read("src/pages/portal/MemberMyParishPage.tsx");
const mobileHome = read("src/components/portal/MobileMemberHome.tsx");

describe("member parish schedule visual copy contract", () => {
  it("uses Ratiba ya Parokia for the member schedule surface", () => {
    expect(calendar).toContain("Ratiba ya Parokia");
    expect(calendar).toContain("Misa na matukio yajayo katika parokia yako.");
    expect(serviceRegistry).toContain('label: "Ratiba ya Parokia"');
    expect(serviceRegistry).toContain('backTitle: "Ratiba"');
  });

  it("defines the intended member agenda groups without requiring empty sections", () => {
    expect(calendar).toContain('title: "Leo"');
    expect(calendar).toContain('title: "Wiki Hii"');
    expect(calendar).toContain('title: "Baadaye"');
    expect(calendar).toContain("groups.filter((group) => group.items.length > 0)");
  });

  it("keeps Misa and Tukio distinctions visible on agenda items", () => {
    expect(calendar).toContain('kind: "Misa"');
    expect(calendar).toContain('event.event_type || "Tukio"');
    expect(calendar).toContain('item.source === "mass"');
    expect(calendar).toContain("<MemberScheduleItem");
  });

  it("uses Tanzania timezone presentation helpers without changing backend filtering", () => {
    expect(calendar).toContain('const TANZANIA_TIME_ZONE = "Africa/Dar_es_Salaam"');
    expect(calendar).toContain("getTanzaniaDateKey");
    expect(calendar).toContain("getUpcomingSundayKey");
    expect(calendar).toContain('.gte("start_date", now)');
    expect(calendar).toContain('.gte("occurrence_date", today)');
  });

  it("uses Ratiba for member navigation copy while preserving the route", () => {
    expect(portalLayout).toContain('{ titleKey: "Ratiba", url: "/portal/calendar", icon: EventsIcon, featureKey: "events" }');
    expect(memberMyParish).toContain('to="/portal/calendar"');
    expect(memberMyParish).toContain('title="Ratiba"');
    expect(mobileHome).toContain('to="/portal/calendar"');
    expect(mobileHome).toContain(">Ratiba</AppLink>");
  });
});
