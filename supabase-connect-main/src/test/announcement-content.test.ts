import { describe, expect, it } from "vitest";

import {
  announcementHtmlToPlainText,
  getAnnouncementContentStats,
  isRichTextEmpty,
  isSafeAnnouncementUrl,
  normalizeAnnouncementContent,
  sanitizeAnnouncementHtml,
} from "@/lib/announcement-content";
import { buildAnnouncementShareMessage } from "@/lib/whatsapp-share";

describe("announcement rich content", () => {
  it("normalizes legacy plain-text announcements without losing paragraphs", () => {
    expect(normalizeAnnouncementContent("First line\nSecond line\n\nNext paragraph")).toBe(
      "<p>First line<br>Second line</p><p>Next paragraph</p>",
    );
    expect(announcementHtmlToPlainText("Legacy announcement")).toBe("Legacy announcement");
  });

  it("sanitizes rich HTML and preserves only approved presentation", () => {
    const sanitized = sanitizeAnnouncementHtml(
      '<h2 class="WordSection1" style="font-family: Comic Sans; text-align: center">Heading</h2><script>alert(1)</script><p onclick="bad()"><strong>Safe</strong></p>',
    );

    expect(sanitized).toContain('<h2 style="text-align: center">Heading</h2>');
    expect(sanitized).toContain("<strong>Safe</strong>");
    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("font-family");
    expect(sanitized).not.toContain("WordSection1");
  });

  it("accepts safe web links and rejects unsafe protocols", () => {
    expect(isSafeAnnouncementUrl("https://example.com/news")).toBe(true);
    expect(isSafeAnnouncementUrl("http://example.com")).toBe(true);
    expect(isSafeAnnouncementUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeAnnouncementUrl("not a url")).toBe(false);

    const sanitized = sanitizeAnnouncementHtml(
      '<p><a href="https://example.com">Safe</a> <a href="javascript:alert(1)">Unsafe</a></p>',
    );
    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain('rel="noopener noreferrer"');
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("Unsafe");
  });

  it("treats empty editor markup as empty", () => {
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("<p><br></p>")).toBe(true);
    expect(isRichTextEmpty("<p>Announcement</p>")).toBe(false);
  });

  it("converts formatted content to readable plain text for external delivery", () => {
    const html = "<h2>Sunday Mass</h2><ul><li>Arrive early</li><li>Bring a friend</li></ul>";
    const plainText = announcementHtmlToPlainText(html);
    expect(plainText).toContain("Sunday Mass");
    expect(plainText).toContain("\u2022 Arrive early");
    expect(plainText).not.toContain("<h2>");

    const whatsapp = buildAnnouncementShareMessage({ title: "Notice", body: html });
    expect(whatsapp).toContain("Sunday Mass");
    expect(whatsapp).not.toContain("<ul>");
  });

  it("reports word, character, and reading-time information", () => {
    expect(getAnnouncementContentStats("<p>Welcome to Sunday Mass</p>")).toEqual({
      words: 4,
      characters: 22,
      readingMinutes: 1,
    });
  });
});
