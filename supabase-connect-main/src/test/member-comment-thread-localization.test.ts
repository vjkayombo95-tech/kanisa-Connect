import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const source = read("src/components/portal/CommentThread.tsx");
const announcements = read("src/pages/portal/PortalAnnouncements.tsx");
const communityHelp = read("src/pages/portal/PortalCommunityHelp.tsx");
const prayerRequests = read("src/pages/portal/PortalPrayerRequests.tsx");
const en = JSON.parse(read("src/locales/en.json"));
const sw = JSON.parse(read("src/locales/sw.json"));

describe("shared member CommentThread localization", () => {
  it("keeps English and Swahili member_comments locale keys symmetric", () => {
    expect(Object.keys(en.member_comments).sort()).toEqual(Object.keys(sw.member_comments).sort());
  });

  it("uses shared localization and localized date formatting for app-owned defaults", () => {
    expect(source).toContain('import { useTranslation } from "react-i18next"');
    expect(source).toContain('import { formatAppDate } from "@/lib/localization"');
    expect(source).toContain('headingLabel ?? t("member_comments.heading")');
    expect(source).toContain('emptyState ?? t("member_comments.empty")');
    expect(source).toContain('draftPlaceholder ?? t("member_comments.placeholder")');
    expect(source).toContain('t("member_comments.add_voice")');
    expect(source).toContain('t("member_comments.posting")');
    expect(source).toContain('t("member_comments.post_comment")');
    expect(source).toContain("formatAppDate(comment.created_at, i18n.language");
    expect(source).not.toContain("new Date(comment.created_at).toLocaleString()");
  });

  it("preserves caller overrides for page-specific comment framing", () => {
    for (const caller of [announcements, communityHelp, prayerRequests]) {
      expect(caller).toContain("headingLabel={t(");
      expect(caller).toContain("draftPlaceholder={t(");
      expect(caller).toContain("emptyState={t(");
    }
  });

  it("keeps author and body dynamic and does not introduce edit/delete behavior", () => {
    expect(source).toContain("{comment.author_name}");
    expect(source).toContain("{comment.body}");
    expect(source).not.toContain("t(comment.author_name");
    expect(source).not.toContain("t(comment.body");
    expect(source).not.toMatch(/Edit|Delete|onEdit|onDelete/i);
  });
});
