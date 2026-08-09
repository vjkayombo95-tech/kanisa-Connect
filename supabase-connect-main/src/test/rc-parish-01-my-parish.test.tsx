import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("RC-PARISH-01 My Parish", () => {
  it("creates the reusable parish companion widget surface", () => {
    const source = readFileSync(join(root, "src/pages/portal/MyParishPage.tsx"), "utf8");

    expect(source).toContain("export default function MyParishPage");
    expect(source).toContain("TodaysMassWidget");
    expect(source).toContain("MassScheduleWidget");
    expect(source).toContain("ConfessionTimesWidget");
    expect(source).toContain("ParishAnnouncementsWidget");
    expect(source).toContain("UpcomingEventsWidget");
    expect(source).toContain("VolunteerOpportunitiesWidget");
    expect(source).toContain("MassIntentionsWidget");
    expect(source).toContain("LiveStreamWidget");
    expect(source).toContain("ContactParishWidget");
    expect(source).toContain("QuickGiveWidget");
    expect(source).toContain("EmergencyPrayerRequestsWidget");
    expect(source).toContain("ParishNotificationsWidget");
    expect(source).toContain("ParishSpiritualBridgeWidget");
  });

  it("consumes existing parish, liturgy, giving, audio, and ministry services", () => {
    const source = readFileSync(join(root, "src/pages/portal/MyParishPage.tsx"), "utf8");

    expect(source).toContain("useParishCalendarEvents");
    expect(source).toContain("fetchPortalAnnouncements");
    expect(source).toContain("fetchMinistrySummaries");
    expect(source).toContain("fetchTodayLiturgicalReadings");
    expect(source).toContain("fetchMemberCmsDailyReadingByDate");
    expect(source).toContain("fetchTodayPrayer");
    expect(source).toContain("loadAudioTracks");
    expect(source).toContain("audio_progress");
    expect(source).toContain("/portal/give");
    expect(source).toContain("/portal/pledges");
    expect(source).toContain("/portal/mass-intentions");
    expect(source).toContain("/portal/prayer-requests");
  });

  it("registers the member route and workspace navigation without replacing Liturgy Home", () => {
    const routes = readFileSync(join(root, "src/routes/MemberRoutes.tsx"), "utf8");
    const registry = readFileSync(join(root, "src/components/workspace/registry.ts"), "utf8");

    expect(routes).toContain("MyParishPage");
    expect(routes).toContain('path="my-parish"');
    expect(routes).toContain("return <LiturgyHomePage />");
    expect(registry).toContain('id: "my-parish"');
    expect(registry).toContain('to: "/portal/my-parish"');
  });

  it("does not alter completed engine integration boundaries", () => {
    const source = readFileSync(join(root, "src/pages/portal/MyParishPage.tsx"), "utf8");

    expect(source).not.toContain("new SynchronizationEngine");
    expect(source).not.toContain("BibleIndexAdapter");
    expect(source).not.toContain("SpeechEngine");
    expect(source).not.toContain("UniversalAudioPlayer");
  });

  it("documents architecture, data flow, lifecycle, notifications, performance, and extension", () => {
    const docs = readFileSync(join(root, "docs/PARISH_COMPANION.md"), "utf8");

    expect(docs).toContain("Architecture");
    expect(docs).toContain("Data Flow");
    expect(docs).toContain("Parish Lifecycle");
    expect(docs).toContain("Notifications");
    expect(docs).toContain("Performance");
    expect(docs).toContain("Extension");
  });
});
