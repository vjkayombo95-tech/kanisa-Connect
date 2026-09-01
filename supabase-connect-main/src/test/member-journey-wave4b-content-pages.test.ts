import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("member journey Wave 4B content pages", () => {
  const announcements = read("pages/portal/PortalAnnouncements.tsx");
  const events = read("pages/portal/PortalEvents.tsx");
  const sermons = read("pages/portal/PortalSermons.tsx");
  const portalFeatures = read("lib/portal-features.ts");
  const memberRoutes = read("routes/MemberRoutes.tsx");

  it("uses member-facing Swahili page titles instead of legacy English titles", () => {
    expect(announcements).toContain(">Matangazo<");
    expect(events).toContain(">Matukio<");
    expect(sermons).toContain(">Mahubiri<");
    expect(announcements).not.toContain(">Announcements<");
    expect(events).not.toContain(">Events<");
    expect(sermons).not.toContain(">Sermons<");
  });

  it("keeps the pages on the shared member shell with mobile bottom-nav clearance", () => {
    for (const source of [announcements, events, sermons]) {
      expect(source).toContain("<main");
      expect(source).toContain("max-w-5xl");
      expect(source).toContain("pb-28");
      expect(source).toContain("lg:pb-10");
      expect(source).toContain("overflow-x-hidden");
    }
  });

  it("keeps loading, empty, and retry states member-friendly", () => {
    expect(announcements).toContain("Matangazo yanapakiwa");
    expect(announcements).toContain("Hakuna matangazo kwa sasa.");
    expect(announcements).toContain("Imeshindikana kupakia matangazo.");
    expect(events).toContain("Matukio yanapakiwa");
    expect(events).toContain("Hakuna matukio yajayo kwa sasa.");
    expect(events).toContain("Imeshindikana kupakia matukio.");
    expect(sermons).toContain("Mahubiri yanapakiwa");
    expect(sermons).toContain("Hakuna mahubiri kwa sasa.");
    expect(sermons).toContain("Imeshindikana kupakia mahubiri.");
    expect([announcements, events, sermons].join("\n")).not.toContain("Loading...");
  });

  it("preserves route names and existing feature gating contracts", () => {
    expect(memberRoutes).toContain('path="announcements"');
    expect(memberRoutes).toContain('path="events"');
    expect(memberRoutes).toContain('path="sermons"');
    expect(portalFeatures).toContain('{ prefix: "/portal/announcements", featureKey: "announcements" }');
    expect(portalFeatures).toContain('{ prefix: "/portal/events", featureKey: "events" }');
    expect(portalFeatures).toContain('{ prefix: "/portal/sermons", featureKey: "sermons" }');
    expect(announcements).toContain('isFeatureEnabled("announcements")');
    expect(sermons).toContain('isFeatureEnabled("sermons")');
  });

  it("preserves announcement comments, event RSVP, and sermon media contracts", () => {
    expect(announcements).toContain("<CommentThread");
    expect(announcements).toContain("toggleReaction");
    expect(announcements).toContain("addComment");
    expect(announcements).toContain("toggleCommentReaction");
    expect(events).toContain('from("event_attendances")');
    expect(events).toContain('onConflict: "event_id,member_id"');
    expect(events).toContain("respondToEvent.mutate");
    expect(sermons).toContain("s.video_url");
    expect(sermons).toContain("s.audio_url");
    expect(sermons).toContain('target="_blank"');
  });
});
