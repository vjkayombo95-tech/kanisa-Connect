import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const portalSource = readFileSync(resolve(process.cwd(), "src/pages/portal/PortalAnnouncements.tsx"), "utf8");
const dataSource = readFileSync(resolve(process.cwd(), "src/lib/portal-announcements.ts"), "utf8");
const memberDashboardSource = readFileSync(resolve(process.cwd(), "src/components/portal/MemberDashboard.tsx"), "utf8");
const mobileHomeSource = readFileSync(resolve(process.cwd(), "src/components/portal/MobileMemberHome.tsx"), "utf8");
const memberTodaySource = readFileSync(resolve(process.cwd(), "src/pages/portal/MemberTodayPage.tsx"), "utf8");
const memberMyParishSource = readFileSync(resolve(process.cwd(), "src/pages/portal/MemberMyParishPage.tsx"), "utf8");
const legacyPortalDashboardSource = readFileSync(resolve(process.cwd(), "src/pages/portal/PortalDashboard.tsx"), "utf8");
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261003190000_add_announcement_image_key.sql"),
  "utf8",
);

describe("portal announcement images", () => {
  it("supports image_key on portal announcement records and RPC results", () => {
    expect(dataSource).toContain("image_key?: string | null");
    expect(migration).toContain("image_key text");
    expect(migration).toContain("a.image_key");
  });

  it("renders an announcement image when a public media URL can be derived", () => {
    expect(portalSource).toContain("getAnnouncementImageUrl(announcement.image_key)");
    expect(portalSource).toContain("<img");
    expect(portalSource).toContain('loading="lazy"');
    expect(portalSource).toContain('alt={`${announcement.title} announcement image`}');
  });

  it("keeps the normal no-image announcement layout intact", () => {
    expect(portalSource).toContain("<h3 className=\"font-semibold text-lg\">{announcement.title}</h3>");
    expect(portalSource).toContain("<AnnouncementContent content={announcement.content}");
    expect(portalSource).not.toContain("Image unavailable");
  });

  it("renders rich announcement bodies through the sanitized content component", () => {
    expect(portalSource).toContain('import { AnnouncementContent } from "@/components/announcements/AnnouncementContent"');
    expect(portalSource).toContain("<AnnouncementContent content={announcement.content}");
    expect(portalSource).not.toContain('<p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{announcement.content}</p>');
  });

  it("uses readable announcement snippets on member home surfaces", () => {
    for (const source of [
      memberDashboardSource,
      mobileHomeSource,
      memberTodaySource,
      memberMyParishSource,
      legacyPortalDashboardSource,
    ]) {
      expect(source).toContain("announcementHtmlToPlainText");
    }
  });
});
