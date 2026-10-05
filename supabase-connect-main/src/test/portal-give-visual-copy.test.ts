import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("PortalGive visual copy contract", () => {
  const portalGive = read("src/pages/portal/PortalGive.tsx");
  const en = read("src/locales/en.json");
  const sw = read("src/locales/sw.json");

  it("uses localized recording language without payment gateway claims", () => {
    expect(portalGive).toContain('t("member_give.title")');
    expect(portalGive).toContain('t("member_give.subtitle")');
    expect(portalGive).toContain('t("member_give.submit")');
    expect(portalGive).toContain('t("member_give.submit_with_amount", { amount: formatTZS(Number(amount)) })');
    expect(portalGive).not.toMatch(/Pay Now|Proceed to Payment|Complete Payment|Payment successful|Processing payment/i);
    expect(portalGive).not.toMatch(/stripe|paypal|checkout|payment_intent|paymentIntent|gateway/i);
    expect(en).toContain('"title": "Give"');
    expect(sw).toContain('"title": "Michango"');
  });

  it("presents optional contribution details accurately", () => {
    expect(portalGive).toContain('t("member_give.category_label")');
    expect(portalGive).toContain('placeholderKey="member_give.category_placeholder"');
    expect(portalGive).toContain('t("member_give.optional")');
    expect(portalGive).toContain('t("member_give.phone_label")');
    expect(portalGive).toContain('t("member_give.payment_reference_label")');
    expect(portalGive).toContain('t("member_give.payment_reference_helper")');
    expect(portalGive).toContain('t("member_give.after_submit_description")');
    expect(en).toContain("If you already paid through M-Pesa, bank, or another channel");
    expect(sw).toContain("Kama tayari umelipa kupitia M-Pesa, benki au njia nyingine");
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
