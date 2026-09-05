import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const portalPledges = fs.readFileSync(path.join(process.cwd(), "src/pages/portal/PortalPledges.tsx"), "utf8");

describe("PortalPledges visual copy", () => {
  it("uses member-facing Kiswahili page language", () => {
    for (const copy of [
      "Ahadi za Michango",
      "Fuatilia ahadi zako na maendeleo ya michango yako.",
      "Weka Ahadi",
      "Jumla ya Ahadi",
      "Niliyolipa",
      "Salio",
      "Maendeleo",
      "Ahadi Zinazoendelea",
    ]) {
      expect(portalPledges).toContain(copy);
    }
  });

  it("explains pledge creation as a commitment separate from payment approval", () => {
    expect(portalPledges).toContain("Weka kiasi unachoahidi kuchangia.");
    expect(portalPledges).toContain("Malipo yatarekodiwa kando baada ya kuwasilishwa na kuthibitishwa.");
    expect(portalPledges).toContain("Wasilisha Malipo");
    expect(portalPledges).toContain("Malipo yametumwa kwa uthibitisho");
    expect(portalPledges).not.toMatch(/M-Pesa|Airtel Money|Mixx by Yas|Selcom|stripe|paypal|checkout|payment gateway/i);
  });

  it("localizes pledge status and empty or community states", () => {
    for (const copy of [
      "Inasubiri",
      "Inaendelea",
      "Imekamilika",
      "Bado hujaweka ahadi ya mchango.",
      "Unaweza kuweka ahadi mpya na kufuatilia maendeleo yake hapa.",
      "Unahitaji kuunganishwa na Jumuiya kabla ya kuweka ahadi ya mchango.",
    ]) {
      expect(portalPledges).toContain(copy);
    }
  });

  it("keeps no-community create actions disabled with visible guidance", () => {
    expect(portalPledges).toContain("const canOpenCreateDialog = !cannotCreatePledge");
    expect(portalPledges).toContain('disabled={!canOpenCreateDialog}');
    expect(portalPledges).toContain("Unahitaji kuunganishwa na Jumuiya kabla ya kuweka ahadi inayojumuishwa kwenye takwimu za Jumuiya.");
  });

  it("keeps mobile-first layout guardrails in the page shell", () => {
    expect(portalPledges).toContain("pb-28");
    expect(portalPledges.match(/min-w-0/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(portalPledges).toContain("w-full sm:w-auto");
  });
});
