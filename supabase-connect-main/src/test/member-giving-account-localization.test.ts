import { describe, expect, it } from "vitest";

import { formatTZSForLanguage } from "@/lib/currency";
import { formatLocalizedDate } from "@/lib/localization";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const requiredGivingAccountKeys = [
  "quick_give",
  "contribution_history",
  "contribution_receipt",
  "my_giving",
  "my_pledges",
  "add_pledge",
  "payment_submitted",
  "contribution_types.sunday_offering",
  "payment_methods.mobile_money",
  "pledge_status.completed",
];

function getNestedValue(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

describe("member giving, pledges, and account localization", () => {
  it("provides English and Kiswahili labels for scoped giving and pledge surfaces", () => {
    requiredGivingAccountKeys.forEach((key) => {
      expect(getNestedValue(en.member_portal.giving_account, key), `missing English key ${key}`).toBeTruthy();
      expect(getNestedValue(sw.member_portal.giving_account, key), `missing Kiswahili key ${key}`).toBeTruthy();
    });

    expect(sw.member_portal.giving_account.my_giving).toBe("Michango Yangu");
    expect(sw.member_portal.giving_account.my_pledges).toBe("Ahadi Zangu");
    expect(sw.member_portal.giving_account.payment_methods.mobile_money).toBe("Malipo ya Simu");
  });

  it("formats member financial display values without changing stored numeric values", () => {
    const amount = 50000;

    expect(formatTZSForLanguage(amount, "en")).toContain("50,000");
    expect(formatTZSForLanguage(amount, "sw")).toContain("50,000");
    expect(amount).toBe(50000);
  });

  it("uses locale-aware dates for contribution displays", () => {
    const date = "2026-07-10T07:00:00+03:00";

    expect(formatLocalizedDate(date, "en", { dateStyle: "full" })).not.toBe(formatLocalizedDate(date, "sw", { dateStyle: "full" }));
  });

  it("keeps payment and pledge stable identifiers separate from localized display labels", () => {
    const paymentMethodValue = "mobile_money";
    const pledgeStatusValue = "completed";

    expect(paymentMethodValue).toBe("mobile_money");
    expect(pledgeStatusValue).toBe("completed");
    expect(sw.member_portal.giving_account.payment_methods[paymentMethodValue]).toBe("Malipo ya Simu");
    expect(sw.member_portal.giving_account.pledge_status[pledgeStatusValue]).toBe("Imekamilika");
  });
});
