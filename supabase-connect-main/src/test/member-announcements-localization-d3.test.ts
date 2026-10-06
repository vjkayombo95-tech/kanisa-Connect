import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import i18n, { changeAppLanguage } from "@/i18n";
import { formatAppDate } from "@/lib/localization";
import { sanitizeAnnouncementHtml } from "@/lib/announcement-content";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const pageSource = read("src/pages/portal/PortalAnnouncements.tsx");
const helperSource = read("src/lib/portal-announcements.ts");
const routesSource = read("src/routes/MemberRoutes.tsx");
const commentThreadSource = read("src/components/portal/CommentThread.tsx");
const announcementContentSource = read("src/components/announcements/AnnouncementContent.tsx");
const en = JSON.parse(read("src/locales/en.json"));
const sw = JSON.parse(read("src/locales/sw.json"));

describe("member announcements localization D3", () => {
  it("provides English and Kiswahili static announcement UI while preserving dynamic announcement fields", async () => {
    await changeAppLanguage("en");
    expect(i18n.t("member_announcements.title")).toBe("Announcements");
    expect(i18n.t("member_announcements.subtitle")).toBe("Get parish updates and news.");
    expect(i18n.t("member_announcements.empty.title")).toBe("No announcements right now.");
    expect(i18n.t("member_announcements.comments.placeholder")).toBe("Write a kind message...");

    await changeAppLanguage("sw");
    expect(i18n.t("member_announcements.title")).toBe("Matangazo");
    expect(i18n.t("member_announcements.subtitle")).toBe("Pata taarifa na habari mpya kutoka parokiani.");
    expect(i18n.t("member_announcements.empty.title")).toBe("Hakuna matangazo kwa sasa.");
    expect(i18n.t("member_announcements.comments.placeholder")).toBe("Andika ujumbe mwema...");

    expect(pageSource).toContain("{announcement.title}");
    expect(pageSource).toContain("<AnnouncementContent content={announcement.content}");
    expect(pageSource).not.toMatch(/\bt\s*\(\s*announcement\.title/);
    expect(pageSource).not.toContain('t("announcement.title"');
    expect(pageSource).not.toContain("t(announcement.content");
  });

  it("keeps rich/imported content, comments, authors, and tenant-created data dynamic", () => {
    const importedRichContent = '<h2>Parish Update</h2><p>Imported Word body</p><script>alert("x")</script>';
    const sanitized = sanitizeAnnouncementHtml(importedRichContent);
    expect(sanitized).toContain("<h2>Parish Update</h2>");
    expect(sanitized).toContain("<p>Imported Word body</p>");
    expect(sanitized).not.toContain("script");

    expect(pageSource).toContain("author_name: profileMap.get(comment.user_id) || \"\"");
    expect(pageSource).toContain("...comment");
    expect(pageSource).toContain("comments={announcement.comments.map");
    expect(pageSource).toContain('author_name: comment.author_name || t("member_announcements.fallback_member")');
    expect(pageSource).not.toContain("t(comment.body");
    expect(pageSource).not.toContain("t(comment.author_name");
  });

  it("preserves announcement query, active church scope, route, and feature gate contracts", () => {
    expect(pageSource).toContain('queryKey: ["portal-announcements-all", user?.id, churchId]');
    expect(pageSource).toContain("if (!churchId) return []");
    expect(pageSource).toContain("fetchPortalAnnouncements(churchId, 25)");
    expect(pageSource).toContain('enabled: !!churchId && isFeatureEnabled("announcements")');
    expect(pageSource).toContain("getPortalAnnouncementsCache(churchId, 25)");
    expect(helperSource).toContain('supabase.rpc("get_portal_announcements" as never');
    expect(helperSource).toContain("_church_id: churchId");
    expect(helperSource).toContain('.eq("church_id", churchId)');
    expect(routesSource).toContain('const PortalAnnouncements = lazy(() => import("@/pages/portal/PortalAnnouncements"))');
    expect(routesSource).toContain('<Route path="announcements" element={<PortalAnnouncements />} />');
  });

  it("preserves comment and reaction mutations while keeping page-provided labels localized", () => {
    expect(pageSource).toContain('.from("announcement_reactions" as never)');
    expect(pageSource).toContain("announcement_id: announcementId");
    expect(pageSource).toContain("user_id: user.id");
    expect(pageSource).toContain("emoji");
    expect(pageSource).toContain('onConflict: "announcement_id,user_id"');
    expect(pageSource).toContain('.from("announcement_comments" as never)');
    expect(pageSource).toContain("insert({ announcement_id: announcementId, user_id: user.id, body }");
    expect(pageSource).toContain('.from("announcement_comment_reactions" as never)');
    expect(pageSource).toContain('onConflict: "comment_id,user_id"');
    expect(pageSource).toContain('queryClient.invalidateQueries({ queryKey: ["portal-announcements-all"] })');
    expect(pageSource).toContain('headingLabel={t("member_announcements.comments.heading")}');
    expect(pageSource).toContain('draftPlaceholder={t("member_announcements.comments.placeholder")}');
    expect(pageSource).toContain('emptyState={t("member_announcements.comments.empty")}');
    expect(commentThreadSource).toContain('headingLabel ?? t("member_comments.heading")');
  });

  it("localizes date and app-owned image alt copy without changing image keys or dynamic title", () => {
    expect(pageSource).toContain("getAnnouncementImageUrl(announcement.image_key)");
    expect(pageSource).toContain('src={getAnnouncementImageUrl(announcement.image_key) ?? undefined}');
    expect(pageSource).toContain('alt={`${announcement.title} ${t("member_announcements.image_alt_suffix")}`}');
    expect(pageSource).toContain("formatAppDate(announcement.created_at, i18n.language");
    expect(pageSource).not.toContain('toLocaleDateString("en-US"');

    const instant = "2026-10-05T12:15:00Z";
    expect(formatAppDate(instant, "en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })).not.toBe(
      formatAppDate(instant, "sw", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    );
  });

  it("keeps locale namespace parity and app-owned fallback/error copy", () => {
    expect(Object.keys(en.member_announcements).sort()).toEqual(Object.keys(sw.member_announcements).sort());
    expect(en.member_announcements.fallback_member).toBe("Member");
    expect(sw.member_announcements.fallback_member).toBe("Mwanachama");
    expect(pageSource).toContain('t("member_announcements.errors.save_reaction")');
    expect(pageSource).toContain('t("member_announcements.errors.add_comment")');
    expect(pageSource).toContain('t("member_announcements.errors.save_comment_reaction")');
  });

  it("does not modify AnnouncementContent security/rendering behavior", () => {
    expect(announcementContentSource).toContain("sanitizeAnnouncementHtml(content)");
    expect(announcementContentSource).toContain("dangerouslySetInnerHTML");
    expect(announcementContentSource).toContain("isAnnouncementRichText(content)");
    expect(pageSource).toContain('import { AnnouncementContent } from "@/components/announcements/AnnouncementContent"');
  });
});
