import { describe, expect, it } from "vitest";

import { resolveMemberAssistantIntent } from "@/lib/member-assistant";

describe("Uliza Kanisa deterministic member assistant", () => {
  it.each([
    ["Nimechangia kiasi gani?", "contributions", "/portal/contribution-history"],
    ["Nataka kuweka nia ya misa", "mass_intention", "/portal/mass-intentions"],
    ["Misa ya kesho ni saa ngapi?", "mass_schedule", "/portal/calendar"],
    ["Matangazo ya leo", "announcements", "/portal/announcements"],
    ["Nataka kuomba maombi", "prayer_request", "/portal/prayer-requests"],
    ["Nionyeshe injili ya leo", "daily_readings", "/portal/today"],
  ])("routes %s locally", (question, intent, route) => {
    const result = resolveMemberAssistantIntent(question);
    expect(result.intent).toBe(intent);
    expect(result.action?.to).toBe(route);
  });

  it("does not pretend to answer an unknown question", () => {
    const result = resolveMemberAssistantIntent("Nipe historia kamili ya jengo");
    expect(result.intent).toBe("unknown");
    expect(result.action).toBeUndefined();
    expect(result.message).toContain("bado sijalielewa");
  });
});
