import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBER_ASSISTANT_FALLBACK, resolveMemberAssistantIntent } from "@/lib/member-assistant";
import { shouldRenderUlizaKanisa } from "@/lib/uliza-feature-gate";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const page = read("src/pages/portal/KanisaAssistantPage.tsx");
const assistant = read("src/lib/member-assistant.ts");
const routes = read("src/routes/MemberRoutes.tsx");
const gate = read("src/components/portal/UlizaKanisaFeatureGate.tsx");
const registry = read("src/lib/member-service-registry.ts");
const en = JSON.parse(read("src/locales/en.json"));
const sw = JSON.parse(read("src/locales/sw.json"));

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe("Wave G2 member assistant localization", () => {
  it("keeps English and Swahili member_assistant locale structures symmetric", () => {
    expect(flattenKeys(en.member_assistant).sort()).toEqual(flattenKeys(sw.member_assistant).sort());
  });

  it("routes page-owned Uliza UI through localization while preserving mobile layout contracts", () => {
    for (const key of [
      "member_assistant.title",
      "member_assistant.subtitle",
      "member_assistant.greeting",
      "member_assistant.intro",
      "member_assistant.quick_questions.heading",
      "member_assistant.loading",
      "member_assistant.input.placeholder",
      "member_assistant.input.send_aria",
    ]) {
      expect(page).toContain(key);
    }

    for (const layoutContract of ["max-w-3xl", "min-w-0", "pb-28", 'data-testid="uliza-kanisa-page"']) {
      expect(page).toContain(layoutContract);
    }

    for (const staleLiteral of ["<h1 className=\"text-2xl font-bold\">Uliza Kanisa</h1>", "Andika swali lako...", "Inapakia taarifa..."]) {
      expect(page).not.toContain(staleLiteral);
    }
  });

  it("localizes quick-action display labels without changing deterministic questions", () => {
    expect(page).toContain('labelKey: "member_assistant.quick_questions.contributions", question: "Nionyeshe historia ya michango"');
    expect(page).toContain('labelKey: "member_assistant.quick_questions.radio", question: "Radio"');
    expect(page).toContain("{String(t(item.labelKey))}");

    expect(resolveMemberAssistantIntent("Nionyeshe historia ya michango")).toMatchObject({
      intent: "contribution_history",
      route: "/portal/contribution-history",
    });
    expect(resolveMemberAssistantIntent("Radio", { radioEnabled: true, liveMassAvailable: false })).toMatchObject({
      intent: "radio",
      route: "/portal/radio",
    });
  });

  it.each([
    ["michango", "contribution_history", "/portal/contribution-history"],
    ["contribution history", "contribution_history", "/portal/contribution-history"],
    ["nia ya misa", "mass_intentions", "/portal/mass-intentions"],
    ["mass intention", "mass_intentions", "/portal/mass-intentions"],
    ["ratiba ya misa", "mass_schedule", "/portal/calendar"],
    ["mass schedule", "mass_schedule", "/portal/calendar"],
    ["matangazo", "announcements", "/portal/announcements"],
    ["announcement", "announcements", "/portal/announcements"],
    ["tafakari", "reflections", "/portal/reflections"],
    ["reflection", "reflections", "/portal/reflections"],
    ["masomo ya leo", "daily_readings", "/portal/daily-readings"],
    ["daily readings", "daily_readings", "/portal/daily-readings"],
    ["biblia", "bible", "/portal/bible"],
    ["bibilia", "bible", "/portal/bible"],
    ["bible", "bible", "/portal/bible"],
    ["sala", "prayers", "/portal/prayers"],
    ["prayers", "prayers", "/portal/prayers"],
    ["watakatifu", "saints", "/portal/library"],
    ["saints", "saints", "/portal/library"],
    ["kalenda", "calendar", "/portal/calendar"],
    ["parish calendar", "calendar", "/portal/calendar"],
  ])("keeps recognized input %s mapped to the same intent and route", (input, intent, route) => {
    expect(resolveMemberAssistantIntent(input)).toMatchObject({ intent, route });
  });

  it("preserves radio, live Mass, fallback, and staff-only safety contracts", () => {
    expect(resolveMemberAssistantIntent("radio", { radioEnabled: true, liveMassAvailable: false })).toMatchObject({ intent: "radio", action: "navigate", route: "/portal/radio" });
    expect(resolveMemberAssistantIntent("radio", { radioEnabled: false, liveMassAvailable: false })).toMatchObject({ intent: "radio", action: "unavailable", route: null });
    expect(resolveMemberAssistantIntent("live mass", { radioEnabled: false, liveMassAvailable: true })).toMatchObject({ intent: "live_mass", action: "navigate", route: "/portal" });
    expect(resolveMemberAssistantIntent("live mass", { radioEnabled: false, liveMassAvailable: false })).toMatchObject({ intent: "live_mass", action: "unavailable", route: null });
    expect(resolveMemberAssistantIntent("naomba jibu la swali lisilojulikana").response).toBe(MEMBER_ASSISTANT_FALLBACK);
    expect(resolveMemberAssistantIntent("staff finance report")).toMatchObject({ intent: "unknown", route: null });
  });

  it("keeps contribution summary owned by resolved active church and linked member only", () => {
    expect(page).toContain("readOwnContributionSummary(churchId, linkedMember.id)");
    expect(page).not.toContain("readOwnContributionSummary(churchId, draft");
    expect(page).not.toContain("readOwnContributionSummary(churchId, text");
    expect(assistant).toContain("fetchMemberContributionTotal(churchId, memberId)");
  });

  it("keeps responses and action labels localized at the presentation boundary", () => {
    expect(page).toContain("responseKeyByIntent");
    expect(page).toContain("actionLabelKeyByIntent");
    expect(page).toContain("member_assistant.responses.contribution_summary_total");
    expect(page).toContain("member_assistant.actions.contribution_history");
    expect(page).toContain("member_assistant.suggestions.announcements");
    expect(assistant).not.toContain("useTranslation");
  });

  it("does not introduce model, WhatsApp, service-role, or network execution surfaces", () => {
    const combined = `${assistant}\n${page}`;
    for (const forbidden of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "fetch(", "whatsapp", "service_role"]) {
      expect(combined.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps feature gating explicit opt-in and fail-closed", () => {
    expect(shouldRenderUlizaKanisa("loading")).toBe(false);
    expect(shouldRenderUlizaKanisa("disabled")).toBe(false);
    expect(shouldRenderUlizaKanisa("error")).toBe(false);
    expect(shouldRenderUlizaKanisa("enabled")).toBe(true);
    expect(registry).toContain("requiresExplicitChurchEnable: true");
    expect(routes).toContain("<UlizaKanisaFeatureGate>");
    expect(gate).toContain('<Navigate to="/portal" replace />');
  });

  it("does not place dynamic names, questions, or amounts into locale content", () => {
    expect(JSON.stringify(en.member_assistant)).not.toContain("Test Member");
    expect(JSON.stringify(sw.member_assistant)).not.toContain("Test Member");
    expect(JSON.stringify(en.member_assistant)).not.toContain("45000");
    expect(JSON.stringify(sw.member_assistant)).not.toContain("45000");
    expect(page).toContain("{ amount: formatTZS(total) }");
    expect(page).toContain("role: \"member\", text");
  });
});
