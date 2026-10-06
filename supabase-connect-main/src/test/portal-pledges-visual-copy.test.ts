import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const portalPledges = fs.readFileSync(path.join(process.cwd(), "src/pages/portal/PortalPledges.tsx"), "utf8");
const pledgePaymentDialog = fs.readFileSync(path.join(process.cwd(), "src/components/pledges/PledgePaymentDialog.tsx"), "utf8");
const en = fs.readFileSync(path.join(process.cwd(), "src/locales/en.json"), "utf8");
const sw = fs.readFileSync(path.join(process.cwd(), "src/locales/sw.json"), "utf8");

describe("PortalPledges visual copy", () => {
  it("uses localized member-facing page language", () => {
    for (const copy of [
      't("member_pledges.title")',
      't("member_pledges.subtitle")',
      't("member_pledges.actions.create")',
      't("member_pledges.summary.total_pledged")',
      't("member_pledges.summary.total_paid")',
      't("member_pledges.summary.remaining")',
      't("member_pledges.summary.progress")',
      't("member_pledges.list.title")',
    ]) {
      expect(portalPledges).toContain(copy);
    }
    expect(en).toContain('"title": "Pledges"');
    expect(sw).toContain('"title": "Ahadi za Michango"');
  });

  it("explains pledge creation as a commitment separate from payment approval", () => {
    expect(portalPledges).toContain('t("member_pledges.create.helper")');
    expect(portalPledges).toContain('t("member_pledges.actions.pay")');
    expect(portalPledges).toContain('t("member_pledges.payment.success_title")');
    expect(portalPledges).not.toMatch(/M-Pesa|Airtel Money|Mixx by Yas|Selcom|stripe|paypal|checkout|payment gateway/i);
    expect(sw).toContain("Weka kiasi unachoahidi kuchangia.");
    expect(sw).toContain("Malipo yatarekodiwa kando baada ya kuwasilishwa na kuthibitishwa.");
  });

  it("localizes pledge status and empty or community states", () => {
    for (const copy of [
      '"pending": "Pending"',
      '"partial": "In progress"',
      '"completed": "Completed"',
      '"pending": "Inasubiri"',
      '"partial": "Inaendelea"',
      '"completed": "Imekamilika"',
      "Bado hujaweka ahadi ya mchango.",
      "Unaweza kuweka ahadi mpya na kufuatilia maendeleo yake hapa.",
      "Unahitaji kuunganishwa na Jumuiya kabla ya kuweka ahadi ya mchango.",
    ]) {
      expect(`${en}\n${sw}`).toContain(copy);
    }
    expect(portalPledges).toContain('t(`member_pledges.status.${pledge.status}`, { defaultValue: pledge.status })');
  });

  it("keeps no-community create actions disabled with visible guidance", () => {
    expect(portalPledges).toContain("const canOpenCreateDialog = !cannotCreatePledge");
    expect(portalPledges).toContain('disabled={!canOpenCreateDialog}');
    expect(portalPledges).toContain('t("member_pledges.states.no_community_page")');
  });

  it("localizes pledge payment dialog copy without translating submitted method values", () => {
    expect(pledgePaymentDialog).toContain('const PAYMENT_METHODS = ["cash", "mobile_money", "bank_transfer", "card", "other"] as const');
    expect(pledgePaymentDialog).toContain('t("pledge_payment_dialog.description"');
    expect(pledgePaymentDialog).toContain('t("pledge_payment_dialog.amount_label")');
    expect(pledgePaymentDialog).toContain('t("pledge_payment_dialog.transaction_id_label")');
    expect(pledgePaymentDialog).toContain('t("pledge_payment_dialog.proof_label")');
    expect(pledgePaymentDialog).toContain('t("pledge_payment_dialog.submit")');
    expect(en).toContain('"Submit for Approval"');
    expect(sw).toContain('"Wasilisha kwa Uthibitisho"');
  });

  it("keeps mobile-first layout guardrails in the page shell", () => {
    expect(portalPledges).toContain("pb-28");
    expect(portalPledges.match(/min-w-0/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(portalPledges).toContain("w-full sm:w-auto");
  });
});
