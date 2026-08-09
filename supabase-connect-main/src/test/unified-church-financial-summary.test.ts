import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeChurchFinancialSummary } from "@/lib/church-financial-summary";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

function migration(name: string) {
  return readFileSync(path.resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("RC-2.9.3 unified church financial summary", () => {
  const sql = migration("20260704138000_unified_church_financial_summary.sql");

  it("normalizes the aggregate RPC payload into camelCase UI fields", () => {
    expect(
      normalizeChurchFinancialSummary({
        total_received: "60000",
        this_month_received: 10000,
        transaction_count: 2,
        contribution_total: 50000,
        pledge_payment_total: null,
        event_registration_total: "10000",
        this_month_contribution_total: 0,
        this_month_pledge_payment_total: 0,
        this_month_event_registration_total: 10000,
        contribution_count: 1,
        pledge_payment_count: 0,
        event_registration_count: 1,
      }),
    ).toMatchObject({
      totalReceived: 60000,
      thisMonthReceived: 10000,
      transactionCount: 2,
      contributionTotal: 50000,
      pledgePaymentTotal: 0,
      eventRegistrationTotal: 10000,
      eventRegistrationCount: 1,
    });
  });

  it("uses server-side source projections without inserting event payments into contributions", () => {
    expect(sql).toContain("create or replace function public.get_church_financial_summary");
    expect(sql).toContain("returns jsonb");
    expect(sql).toContain("from public.contributions");
    expect(sql).toContain("from public.pledge_payments pp");
    expect(sql).toContain("from public.event_registration_payments");
    expect(sql).not.toContain("insert into public.contributions");
    expect(sql).not.toContain("create table public.church_financial_ledger");
  });

  it("counts only verified source rows and excludes pending or rejected evidence", () => {
    expect(sql).toContain("coalesce(pp.verification_status, 'pending') = 'approved'");
    expect(sql).toContain("coalesce(status, 'pending') = 'approved'");
    expect(sql).not.toContain("status in ('pending', 'approved'");
    expect(sql).not.toContain("verification_status in ('pending', 'approved'");
  });

  it("does not count pledge promises as received income", () => {
    expect(sql).toContain("join public.pledges p on p.id = pp.pledge_id");
    expect(sql).not.toContain("sum(p.amount)");
    expect(sql).not.toContain("sum(p.target_amount)");
    expect(sql).not.toContain("from public.pledges\n      where");
  });

  it("protects parish-wide totals by church workspace authorization", () => {
    expect(sql).toContain("public.can_manage_church_workspace(auth.uid(), _church_id)");
    expect(sql).toContain("public.can_manage_church_roles(auth.uid(), _church_id)");
    expect(sql).toContain("public.is_platform_super_admin(auth.uid())");
    expect(sql).toContain("grant execute on function public.get_church_financial_summary(uuid, date, date) to authenticated");
  });

  it("keeps the required English and Kiswahili terminology available", () => {
    expect(en.finance_summary.total_received).toBe("Total Received");
    expect(en.finance_summary.event_registration_revenue).toBe("Event Registration Revenue");
    expect(sw.finance_summary.total_received).toBe("Jumla Iliyopokelewa");
    expect(sw.finance_summary.event_registration_revenue).toBe("Mapato ya Usajili wa Matukio");
  });
});
