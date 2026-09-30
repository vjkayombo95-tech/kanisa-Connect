import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({ fetchMemberContributionTotalForRange: vi.fn() }));
vi.mock("@/lib/member-contributions", () => ({ fetchMemberContributionTotalForRange: mocks.fetchMemberContributionTotalForRange }));

import {
  MEMBER_ASSISTANT_FALLBACK,
  normalizeMemberQuestion,
  readOwnContributionSummary,
  resolveMemberAssistantIntent,
} from "@/lib/member-assistant";

describe("production Wave 5B deterministic Uliza Kanisa", () => {
  beforeEach(() => mocks.fetchMemberContributionTotalForRange.mockReset());

  it.each([
    ["nataka kuchangia", "contribute", "/portal/give"],
    ["historia ya michango", "contribution_history", "/portal/contribution-history"],
    ["nia ya misa", "mass_intentions", "/portal/mass-intentions"],
    ["ratiba ya misa", "mass_schedule", "/portal/calendar"],
    ["matangazo", "announcements", "/portal/announcements"],
    ["sala", "prayers", "/portal/prayers"],
    ["tafakari", "reflections", "/portal/reflections"],
    ["bibilia", "bible", "/portal/bible"],
    ["masomo ya leo", "daily_readings", "/portal/daily-readings"],
    ["kalenda", "calendar", "/portal/calendar"],
    ["watakatifu", "saints", "/portal/library"],
  ])("maps %s to the safe member route", (input, intent, route) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({ intent, route, action: "navigate" });
  });

  it("normalizes casing, punctuation, accents, and whitespace", () => {
    expect(normalizeMemberQuestion("  BÍBLIA!!!  ")).toBe("biblia");
  });

  it("distinguishes an own-contribution read from contribution navigation", () => {
    expect(resolveMemberAssistantIntent("Nimechangia kiasi gani?")).toMatchObject({ intent: "own_contributions", contributionRange: "all_time", action: "read", route: null });
  });

  it.each([
    ["Nimechangia kiasi gani leo?", "today"],
    ["Michango yangu leo", "today"],
    ["Nimechangia kiasi gani wiki hii?", "this_week"],
    ["Michango yangu wiki hii", "this_week"],
    ["Nimechangia kiasi gani mwezi huu?", "this_month"],
    ["Michango yangu mwezi huu", "this_month"],
    ["Nimechangia kiasi gani?", "all_time"],
  ])("resolves the own-contribution range for %s", (input, contributionRange) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({
      intent: "own_contributions",
      contributionRange,
      action: "read",
      route: null,
    });
  });

  it.each([
    "Misa ijayo ni lini?",
    "Misa inayofuata ni saa ngapi?",
    "Misa ijayo ni saa ngapi?",
    "Misa inayofuata ni lini?",
    "Misa ijayo ni ipi?",
  ])("resolves the next timetable Mass intent: %s", (input) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({
      intent: "next_mass",
      action: "read",
      route: null,
    });
  });

  it.each([
    "Nia za Misa",
    "Nia yangu ya Misa",
    "Nataka kuweka nia ya Misa",
  ])("does not collide with Mass Intention wording: %s", (input) => {
    expect(resolveMemberAssistantIntent(input).intent).toBe("mass_intentions");
  });

  it.each([
    "Nia zangu za Misa zikoje?",
    "Nia yangu ya Misa imekubaliwa?",
    "Nia zangu zina hali gani?",
    "Nina Nia za Misa zinazosubiri?",
    "Nionyeshe hali ya Nia zangu za Misa",
  ])("resolves own Mass Intention status questions: %s", (input) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({
      intent: "mass_intentions",
      action: "read",
      route: null,
      massIntentionsMode: "status",
    });
  });

  it.each([
    "Nataka kuweka nia ya Misa",
    "Niweke Nia ya Misa",
  ])("preserves create Mass Intention navigation: %s", (input) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({
      intent: "mass_intentions",
      action: "navigate",
      route: "/portal/mass-intentions",
    });
  });

  it.each([
    "Nionyeshe Nia za Misa za John",
    "Nia za member-foreign-123 zikoje?",
    "Nia zangu za Misa za John zikoje?",
    "Nionyeshe Nia zote za kanisa",
    "Nia za wanachama wote",
    "Nia zilizokataliwa za watu wote",
  ])("does not resolve unsafe Mass Intention lookup: %s", (input) => {
    expect(resolveMemberAssistantIntent(input).intent).toBe("unknown");
  });

  it.each([
    "Kuna tangazo jipya?",
    "Tangazo la mwisho ni lipi?",
    "Tangazo la hivi karibuni ni lipi?",
    "Nionyeshe tangazo la mwisho",
    "Matangazo mapya yapo?",
  ])("resolves the latest announcement intent: %s", (input) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({
      intent: "latest_announcement",
      action: "read",
      route: null,
    });
  });

  it.each([
    "michango",
    "nataka kuona michango",
    "naomba kuona michango",
    "onyesha michango yangu",
    "nione michango yangu",
  ])("maps the natural member contribution phrase to owned history: %s", (input) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({
      intent: "contribution_history",
      action: "navigate",
      route: "/portal/contribution-history",
    });
  });

  it("maps bare Michango yangu to the owned all-time contribution summary flow", () => {
    expect(resolveMemberAssistantIntent("Michango yangu")).toMatchObject({
      intent: "own_contributions",
      action: "read",
      route: null,
      contributionRange: "all_time",
    });
  });
  it("preserves specific contribution intent precedence", () => {
    expect(resolveMemberAssistantIntent("historia ya michango yangu")).toMatchObject({ intent: "contribution_history", matchClass: "keyword" });
    expect(resolveMemberAssistantIntent("nimechangia kiasi gani")).toMatchObject({ intent: "own_contributions", contributionRange: "all_time", matchClass: "exact" });
    expect(resolveMemberAssistantIntent("nataka kuchangia")).toMatchObject({ intent: "contribute", route: "/portal/give" });
  });

  it("preserves the existing all-time contribution summary contract for the legacy question", () => {
    expect(resolveMemberAssistantIntent("Jumla ya michango yangu")).toMatchObject({
      intent: "contribution_summary",
      action: "read",
      route: null,
    });
  });

  it.each([
    "Nataka kuona michango",
    "nataka kuona michango?",
    "  nataka   kuona michango  ",
  ])("normalizes natural contribution wording: %s", (input) => {
    expect(resolveMemberAssistantIntent(input).intent).toBe("contribution_history");
  });

  it("reads contributions only with resolved church and linked-member identifiers", async () => {
    mocks.fetchMemberContributionTotalForRange.mockResolvedValue(45000);
    await expect(readOwnContributionSummary("church-current", "member-linked")).resolves.toBe(45000);
    expect(mocks.fetchMemberContributionTotalForRange).toHaveBeenCalledWith("church-current", "member-linked", "all_time");
  });

  it("does not accept or resolve a foreign member identifier from question text", () => {
    const result = resolveMemberAssistantIntent("onyesha michango ya member-foreign-123");
    expect(result.intent).toBe("unknown");
    expect(result.route).toBeNull();
  });

  it("allows Radio navigation only when Radio is enabled", () => {
    expect(resolveMemberAssistantIntent("radio", { radioEnabled: true, liveMassAvailable: false })).toMatchObject({ intent: "radio", route: "/portal/radio", action: "navigate" });
    expect(resolveMemberAssistantIntent("radio", { radioEnabled: false, liveMassAvailable: false })).toMatchObject({ intent: "radio", route: null, action: "unavailable" });
  });

  it("does not initialize media for a Radio question", () => {
    const originalAudio = globalThis.Audio;
    const audio = vi.fn();
    Object.defineProperty(globalThis, "Audio", { configurable: true, value: audio });
    resolveMemberAssistantIntent("radio", { radioEnabled: true, liveMassAvailable: false });
    expect(audio).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, "Audio", { configurable: true, value: originalAudio });
  });

  it("offers Live Mass only when a current authorized stream is available", () => {
    expect(resolveMemberAssistantIntent("misa live", { radioEnabled: false, liveMassAvailable: true })).toMatchObject({ intent: "live_mass", route: "/portal", action: "navigate" });
    expect(resolveMemberAssistantIntent("misa live", { radioEnabled: false, liveMassAvailable: false })).toMatchObject({ intent: "live_mass", route: null, action: "unavailable" });
  });

  it("uses a deterministic non-inventive fallback", () => {
    expect(resolveMemberAssistantIntent("naomba jibu la swali lisilojulikana")).toEqual({ intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK });
  });

  it.each([
    "onyesha mapato ya wanachama wote",
    "staff finance report",
    "orodha ya wanachama wote",
    "unresolved prayer request totals",
    "operational dashboard",
    "download contribution report pdf",
    "onyesha michango ya wanachama wote",
    "michango ya watu wote",
    "ripoti ya michango ya kanisa",
    "nipe ripoti ya fedha",
    "onyesha taarifa za wanachama",
    "top contributors",
    "inactive contributors",
    "ripoti ya fedha ya kanisa",
    "download contribution report pdf",
    "onyesha michango ya member-foreign-123",
    "Nimechangia kiasi gani member-123?",
    "Nionyeshe michango yangu ya John",
    "Misa ijayo ya church abc ni lini?",
    "Tangazo jipya la parish nyingine?",
  ])("does not expose the staff-only request: %s", (input) => {
    expect(resolveMemberAssistantIntent(input).intent).toBe("unknown");
  });

  it("contains no model-provider or WhatsApp execution surface", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/member-assistant.ts"), "utf8");
    for (const forbidden of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "fetch(", "whatsapp", "service_role"]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
