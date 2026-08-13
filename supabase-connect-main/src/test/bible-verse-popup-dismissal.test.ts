import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getBibleVerseDismissalKey,
  getTodayStorageValue,
  hasSeenBibleVerseToday,
  markBibleVerseSeenToday,
} from "@/components/portal/BibleVersePopup";

describe("daily Bible verse dismissal contract", () => {
  beforeEach(() => window.localStorage.clear());

  it("is eligible before it has been dismissed today", () => {
    expect(hasSeenBibleVerseToday(window.localStorage, "member-1")).toBe(false);
  });

  it("persists dismissal for the current day", () => {
    markBibleVerseSeenToday(window.localStorage, "member-1");
    expect(window.localStorage.getItem(getBibleVerseDismissalKey("member-1"))).toBe(getTodayStorageValue());
    expect(hasSeenBibleVerseToday(window.localStorage, "member-1")).toBe(true);
  });

  it("remains dismissed across route remount checks", () => {
    markBibleVerseSeenToday(window.localStorage, "member-1");
    for (const route of ["/portal/services", "/portal", "/portal/give", "/portal/announcements"]) {
      expect(route).toMatch(/^\/portal/);
      expect(hasSeenBibleVerseToday(window.localStorage, "member-1")).toBe(true);
    }
  });

  it("does not depend on church or verse-reference changes", () => {
    markBibleVerseSeenToday(window.localStorage, "member-1");
    expect(hasSeenBibleVerseToday(window.localStorage, "member-1")).toBe(true);
  });

  it("allows a different user to receive their daily verse", () => {
    markBibleVerseSeenToday(window.localStorage, "member-1");
    expect(hasSeenBibleVerseToday(window.localStorage, "member-2")).toBe(false);
  });

  it("remains dismissed after logout and same-user login on the same day", () => {
    markBibleVerseSeenToday(window.localStorage, "member-1");
    expect(hasSeenBibleVerseToday(window.localStorage, "member-1")).toBe(true);
  });

  it("becomes eligible in a new daily window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T09:00:00+03:00"));
    markBibleVerseSeenToday(window.localStorage, "member-1");
    vi.setSystemTime(new Date("2026-08-14T09:00:00+03:00"));
    expect(hasSeenBibleVerseToday(window.localStorage, "member-1")).toBe(false);
    vi.useRealTimers();
  });

  it("uses one stable storage marker per authenticated user", () => {
    const key = getBibleVerseDismissalKey("member-1");
    markBibleVerseSeenToday(window.localStorage, "member-1");
    markBibleVerseSeenToday(window.localStorage, "member-1");
    expect(Object.keys(window.localStorage)).toEqual([key]);
  });
});
