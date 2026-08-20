import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({ fetchMemberContributionTotal: vi.fn() }));
vi.mock("@/lib/member-contributions", () => ({ fetchMemberContributionTotal: mocks.fetchMemberContributionTotal }));

import {
  MEMBER_ASSISTANT_FALLBACK,
  normalizeMemberQuestion,
  readOwnContributionSummary,
  resolveMemberAssistantIntent,
} from "@/lib/member-assistant";

describe("production Wave 5B deterministic Uliza Kanisa", () => {
  beforeEach(() => mocks.fetchMemberContributionTotal.mockReset());

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
    expect(resolveMemberAssistantIntent("jumla ya michango yangu")).toMatchObject({ intent: "contribution_summary", action: "read", route: null });
  });

  it.each([
    "michango",
    "nataka kuona michango",
    "naomba kuona michango",
    "onyesha michango yangu",
    "michango yangu",
    "nione michango yangu",
  ])("maps the natural member contribution phrase to owned history: %s", (input) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({
      intent: "contribution_history",
      action: "navigate",
      route: "/portal/contribution-history",
    });
  });

  it("preserves specific contribution intent precedence", () => {
    expect(resolveMemberAssistantIntent("historia ya michango yangu")).toMatchObject({ intent: "contribution_history", matchClass: "keyword" });
    expect(resolveMemberAssistantIntent("jumla ya michango yangu")).toMatchObject({ intent: "contribution_summary", matchClass: "exact" });
    expect(resolveMemberAssistantIntent("nataka kuchangia")).toMatchObject({ intent: "contribute", route: "/portal/give" });
  });

  it.each([
    "Nataka kuona michango",
    "nataka kuona michango?",
    "  nataka   kuona michango  ",
  ])("normalizes natural contribution wording: %s", (input) => {
    expect(resolveMemberAssistantIntent(input).intent).toBe("contribution_history");
  });

  it("reads contributions only with resolved church and linked-member identifiers", async () => {
    mocks.fetchMemberContributionTotal.mockResolvedValue(45000);
    await expect(readOwnContributionSummary("church-current", "member-linked")).resolves.toBe(45000);
    expect(mocks.fetchMemberContributionTotal).toHaveBeenCalledWith("church-current", "member-linked");
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
