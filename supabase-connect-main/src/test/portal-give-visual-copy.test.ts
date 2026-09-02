import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("PortalGive visual copy contract", () => {
  const portalGive = read("src/pages/portal/PortalGive.tsx");

  it("uses Kiswahili-first recording language without payment gateway claims", () => {
    expect(portalGive).toContain(">Michango</h1>");
    expect(portalGive).toContain("Rekodi mchango wako kwa parokia.");
    expect(portalGive).toContain("Rekodi Mchango");
    expect(portalGive).toContain("Rekodi ${formatTZS(Number(amount))}");
    expect(portalGive).not.toMatch(/Pay Now|Proceed to Payment|Complete Payment|Payment successful|Processing payment/i);
    expect(portalGive).not.toMatch(/stripe|paypal|checkout|payment_intent|paymentIntent|gateway/i);
  });

  it("presents optional contribution details accurately", () => {
    expect(portalGive).toContain("Aina ya mchango");
    expect(portalGive).toContain("Chagua aina ya mchango");
    expect(portalGive).toContain("Si lazima");
    expect(portalGive).toContain("Namba ya simu");
    expect(portalGive).toContain("Kumbukumbu ya malipo");
    expect(portalGive).toContain("Kama tayari umelipa kupitia M-Pesa, benki au njia nyingine");
    expect(portalGive).toContain("Hii si uthibitisho wa malipo ya kielektroniki.");
  });

  it("keeps the member page spacious and mobile conscious", () => {
    expect(portalGive).toContain("max-w-5xl");
    expect(portalGive).toContain("pb-28");
    expect(portalGive).toContain("lg:grid-cols-[minmax(0,1fr)_320px]");
    expect(portalGive).toContain("sm:grid-cols-2");
    expect(portalGive).toContain("sm:grid-cols-5");
    expect(portalGive).toContain("grid min-w-0 grid-cols-2");
    expect(portalGive).toContain("min-w-0 whitespace-normal");
  });
});
