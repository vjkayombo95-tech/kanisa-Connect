import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const popup = read("src/components/portal/BibleVersePopup.tsx");
const gate = read("src/components/portal/UlizaKanisaFeatureGate.tsx");

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe("shared member portal component localization", () => {
  it("keeps Bible verse popup English and Kiswahili locale structures symmetric", () => {
    expect(flattenKeys(en.member_bible_verse_popup).sort()).toEqual(flattenKeys(sw.member_bible_verse_popup).sort());
    expect(en.member_bible_verse_popup.aria_label).toBe("Daily Bible verse");
    expect(sw.member_bible_verse_popup.aria_label).toBe("Aya ya Biblia ya kila siku");
    expect(en.member_bible_verse_popup.actions.continue).toBe("Continue");
    expect(sw.member_bible_verse_popup.actions.continue).toBe("Endelea");
  });

  it("routes Bible verse popup app-owned copy through translations", () => {
    for (const key of [
      "member_bible_verse_popup.aria_label",
      "member_bible_verse_popup.greetings.admin",
      "member_bible_verse_popup.greetings.pastor",
      "member_bible_verse_popup.greetings.member",
      "member_bible_verse_popup.blessings.admin",
      "member_bible_verse_popup.blessings.pastor",
      "member_bible_verse_popup.blessings.member",
      "member_bible_verse_popup.fallbacks.church",
      "member_bible_verse_popup.fallbacks.reference",
      "member_bible_verse_popup.logo_alt",
      "member_bible_verse_popup.daily_blessing",
      "member_bible_verse_popup.welcome",
      "member_bible_verse_popup.verse_of_day",
      "member_bible_verse_popup.actions.amen",
      "member_bible_verse_popup.actions.continue",
    ]) {
      expect(popup).toContain(key);
    }

    for (const staleLiteral of [
      'aria-label="Daily Bible verse"',
      "Daily Blessing",
      "Welcome, {userName}",
      "Bible Verse of the Day",
      "Amen",
      "Continue",
      "Your Church",
      "Daily Verse",
    ]) {
      expect(popup).not.toContain(staleLiteral);
    }
  });

  it("keeps dynamic Bible verse, church, and user content unmodified", () => {
    expect(popup).toContain("verseText,");
    expect(popup).toContain("verseReference: verse?.reference?.trim()");
    expect(popup).toContain("{data.verseText}");
    expect(popup).toContain("{data.verseReference}");
    expect(popup).toContain("{data.churchName}");
    expect(popup).toContain("name: userName");
    expect(popup).not.toContain("t(data.verseText");
    expect(popup).not.toContain("t(data.verseReference");
    expect(popup).not.toContain("t(data.churchName");
    expect(popup).not.toContain("t(userName");
  });

  it("preserves Bible verse popup role and dismissal behavior", () => {
    expect(popup).toContain('type PopupRole = "admin" | "pastor" | "member"');
    expect(popup).toContain('if (role === "pastor") return "pastor"');
    expect(popup).toContain('if (role === "church_admin" || role === "secretary" || role === "treasurer") return "admin"');
    expect(popup).toContain('const STORAGE_KEY = "verseSeenToday"');
    expect(popup).toContain("getBibleVerseDismissalKey(userId)");
    expect(popup).toContain("markBibleVerseSeenToday(window.localStorage, user?.id)");
    expect(popup).toContain('event.key === "Escape"');
  });

  it("localizes Uliza Kanisa feature gate loading copy without changing gating behavior", () => {
    expect(flattenKeys(en.member_assistant).sort()).toEqual(flattenKeys(sw.member_assistant).sort());
    expect(en.member_assistant.loading_service).toBe("Loading service...");
    expect(sw.member_assistant.loading_service).toBe("Inapakia huduma...");
    expect(gate).toContain("useTranslation");
    expect(gate).toContain('t("member_assistant.loading_service")');
    expect(gate).toContain('getExplicitChurchFeatureResolution("kanisa_ai")');
    expect(gate).toContain("shouldRenderUlizaKanisa(resolution)");
    expect(gate).toContain('<Navigate to="/portal" replace />');
    expect(gate).not.toContain("Inapakia huduma...");
  });
});
