import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("RC-LITURGY-01 Catholic Daily Experience", () => {
  it("creates the liturgy home component hierarchy", () => {
    const source = readFileSync(join(root, "src/pages/portal/LiturgyHomePage.tsx"), "utf8");

    expect(source).toContain("export default function LiturgyHomePage");
    expect(source).toContain("TodaysLiturgicalDayCard");
    expect(source).toContain("TodaysReadingsCard");
    expect(source).toContain("TodaysSaintCard");
    expect(source).toContain("PrayerOfTheDayCard");
    expect(source).toContain("TodaysHomilyCard");
    expect(source).toContain("ContinueReadingCard");
    expect(source).toContain("ContinueListeningCard");
    expect(source).toContain("UpcomingCelebrationsCard");
  });

  it("uses existing liturgy, saints, audio, Bible reader, and study services", () => {
    const source = readFileSync(join(root, "src/pages/portal/LiturgyHomePage.tsx"), "utf8");

    expect(source).toContain("fetchTodayLiturgicalReadings");
    expect(source).toContain("fetchMemberCmsDailyReadingByDate");
    expect(source).toContain("fetchSaintOfDayFromLiturgy");
    expect(source).toContain("fetchTodayPrayer");
    expect(source).toContain("UniversalAudioPlayer");
    expect(source).toContain("loadAudioContent");
    expect(source).toContain("loadAudioTracks");
    expect(source).toContain("bibleReferenceToPath");
    expect(source).toContain("content_bookmarks");
    expect(source).toContain("content_notes");
    expect(source).toContain("content_favorites");
  });

  it("makes the daily companion the portal landing route without removing the dashboard", () => {
    const routes = readFileSync(join(root, "src/routes/MemberRoutes.tsx"), "utf8");

    expect(routes).toContain("LiturgyHomePage");
    expect(routes).toContain("return <LiturgyHomePage />");
    expect(routes).toContain('path="dashboard"');
    expect(routes).toContain("PortalDashboardRoute");
  });

  it("does not modify completed platform engines", () => {
    const source = readFileSync(join(root, "src/pages/portal/LiturgyHomePage.tsx"), "utf8");
    const syncEngine = readFileSync(join(root, "src/lib/synchronization/engine.ts"), "utf8");
    const audioPlatform = readFileSync(join(root, "src/lib/universal-audio.ts"), "utf8");

    expect(source).not.toContain("new SynchronizationEngine");
    expect(source).not.toContain("BibleIndexAdapter");
    expect(syncEngine).toContain("while (low <= high)");
    expect(audioPlatform).toContain("loadAudioContent");
  });

  it("documents architecture, data flow, integration points, performance, and future expansion", () => {
    const docs = readFileSync(join(root, "docs/CATHOLIC_DAILY_EXPERIENCE.md"), "utf8");

    expect(docs).toContain("Architecture");
    expect(docs).toContain("Data Flow");
    expect(docs).toContain("Integration Points");
    expect(docs).toContain("Performance");
    expect(docs).toContain("Future Expansion");
  });
});
