import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  canRequestFinancialSummary,
  normalizeFinancialSummary,
  normalizePendingCounts,
  visiblePendingActions,
} from "@/lib/church-dashboard-intelligence";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("Release B production dashboard intelligence", () => {
  const counts = normalizePendingCounts({
    events: 1,
    sacraments: 99,
    massIntentions: 2,
    prayerRequests: 3,
    communityHelp: 4,
    invitations: 5,
    announcements: 6,
    payments: 7,
    memberships: 8,
    volunteers: 9,
    total: 999,
  });

  it("normalizes only production-supported pending queues and never trusts a supplied total", () => {
    expect(counts.total).toBe(45);
    expect(counts).not.toHaveProperty("sacraments");
    expect(normalizePendingCounts({ events: -1, payments: "2", volunteers: "invalid" })).toMatchObject({ events: 0, payments: 2, volunteers: 0, total: 2 });
  });

  it("shows only actionable routes already authorized for each production workspace", () => {
    expect(visiblePendingActions(counts, "admin").map((item) => item.route)).toHaveLength(9);
    expect(visiblePendingActions(counts, "pastoral").map((item) => item.route)).toEqual([
      "/church-admin/mass-intentions",
      "/church-admin/prayer-requests",
      "/church-admin/community-help",
      "/church-admin/announcements",
    ]);
    expect(visiblePendingActions(counts, "finance").map((item) => item.route)).toEqual([
      "/church-admin/community-help",
      "/church-admin/qr-payments",
    ]);
    expect(visiblePendingActions(counts, "member")).toEqual([]);
  });

  it("fails closed for financial visibility while retaining verified numeric fields", () => {
    expect(canRequestFinancialSummary("church_admin")).toBe(true);
    expect(canRequestFinancialSummary("treasurer")).toBe(true);
    expect(canRequestFinancialSummary("secretary")).toBe(false);
    expect(canRequestFinancialSummary("pastor")).toBe(false);
    expect(canRequestFinancialSummary("member")).toBe(false);
    expect(normalizeFinancialSummary({ total_received: "60000", this_month_received: 10000, transaction_count: 2 })).toMatchObject({ totalReceived: 60000, thisMonthReceived: 10000, transactionCount: 2 });
  });

  it("uses tenant- and identity-keyed bounded queries only after authoritative context resolves", () => {
    const hook = read("src/hooks/use-church-dashboard-intelligence.ts");
    expect(hook).toContain('authorizationReady && !!churchId && !!user?.id');
    expect(hook).toContain('["production-dashboard-pending", user?.id, churchId]');
    expect(hook).toContain('["production-dashboard-financial", user?.id, churchId]');
    expect(hook).toContain(".abortSignal(signal)");
    expect(hook).toContain("refetchOnWindowFocus: false");
    expect(hook).toContain("retry: false");
    expect(hook).not.toContain("refetchInterval");
    expect(hook).not.toContain("setInterval");
  });

  it("keeps optional RPC failures local and preserves loading, zero, mobile, and Release A contracts", () => {
    const component = read("src/components/church-admin/ChurchDashboardIntelligence.tsx");
    const dashboard = read("src/pages/church-admin/ChurchDashboard.tsx");
    const mobile = read("src/components/staff-mobile/StaffMobileExperience.tsx");
    const routes = read("src/routes/AdminRoutes.tsx");
    expect(component).toContain("pending.isLoading");
    expect(component).toContain("pending.isError");
    expect(component).toContain("No pending work is available for your current role.");
    expect(component).toContain("financial.isError");
    expect(dashboard).toContain("<ChurchDashboardIntelligence />");
    expect(mobile).toContain("<ChurchDashboardIntelligence compact />");
    expect(mobile).toContain("services.filter((service) => service.primary).slice(0, 4)");
    expect(routes).toContain("<Route element={<ChurchAdminLayout />}");
    expect(routes).not.toContain("WorkspaceRouteLayout");
  });

  it("matches the deployed production RPC security and return contracts without migrations", () => {
    const pendingSql = read("supabase/migrations/20260719204500_fix_admin_pending_counts_catalog_identifiers.sql");
    const financeSql = read("supabase/migrations/20260704138000_unified_church_financial_summary.sql");
    for (const sql of [pendingSql, financeSql]) {
      expect(sql).toContain("security definer");
      expect(sql).toContain("auth.uid()");
      expect(sql).toContain("public.can_manage_church_workspace(auth.uid(), _church_id)");
      expect(sql).toContain("returns jsonb");
    }
    expect(pendingSql).toContain("where church_id = $1");
    expect(financeSql).toContain("where church_id = $1");
  });
});
