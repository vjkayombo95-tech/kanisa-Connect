import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHURCH_ADMIN_NOTIFICATION_REFRESH_MS,
  getActionRequiredItems,
  getChurchAdminNotificationItems,
  getChurchAdminSidebarBadge,
  normalizeChurchAdminPendingCounts,
} from "@/lib/church-admin-notifications";

function migration(name: string) {
  return readFileSync(path.resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("church admin pending approval notifications", () => {
  it("normalizes the aggregate RPC response and calculates a fallback total", () => {
    const counts = normalizeChurchAdminPendingCounts({
      events: "2",
      sacraments: 1,
      massIntentions: 3,
      payments: "4",
      memberships: null,
      volunteers: undefined,
    });

    expect(counts).toEqual({
      events: 2,
      sacraments: 1,
      massIntentions: 3,
      payments: 4,
      memberships: 0,
      volunteers: 0,
      total: 10,
    });
  });

  it("maps action queues to the church admin pages that resolve them", () => {
    const counts = normalizeChurchAdminPendingCounts({
      events: 1,
      sacraments: 0,
      massIntentions: 2,
      payments: 1,
      memberships: 1,
      volunteers: 1,
    });
    const actionItems = getActionRequiredItems(counts);

    expect(actionItems.map((item) => [item.key, item.route, item.count])).toEqual([
      ["events", "/church-admin/event-requests", 1],
      ["massIntentions", "/church-admin/mass-intentions", 2],
      ["payments", "/church-admin/events", 1],
      ["memberships", "/church-admin/communities", 1],
      ["volunteers", "/church-admin/ministries", 1],
    ]);
    expect(getChurchAdminNotificationItems(counts)).toHaveLength(6);
  });

  it("maps sidebar menu ids to red badge counts", () => {
    const counts = normalizeChurchAdminPendingCounts({
      events: 5,
      sacraments: 4,
      massIntentions: 3,
      payments: 2,
      memberships: 1,
      volunteers: 6,
    });

    expect(getChurchAdminSidebarBadge("event-requests", counts)).toBe(5);
    expect(getChurchAdminSidebarBadge("sacraments", counts)).toBe(4);
    expect(getChurchAdminSidebarBadge("mass-intentions", counts)).toBe(3);
    expect(getChurchAdminSidebarBadge("events", counts)).toBe(2);
    expect(getChurchAdminSidebarBadge("qr-payments", counts)).toBe(2);
    expect(getChurchAdminSidebarBadge("communities", counts)).toBe(1);
    expect(getChurchAdminSidebarBadge("ministries", counts)).toBe(6);
    expect(getChurchAdminSidebarBadge("reports", counts)).toBe(0);
  });

  it("refreshes the centralized query every sixty seconds", () => {
    expect(CHURCH_ADMIN_NOTIFICATION_REFRESH_MS).toBe(60_000);
  });

  it("keeps the aggregate RPC permission-gated and resilient to optional tables", () => {
    const sql = migration("20260704137000_church_admin_pending_notifications.sql");

    expect(sql).toContain("create or replace function public.get_church_admin_pending_counts");
    expect(sql).toContain("returns jsonb");
    expect(sql).toContain("public.can_manage_church_roles(auth.uid(), _church_id)");
    expect(sql).toContain("public.can_manage_church_workspace(auth.uid(), _church_id)");
    expect(sql).toContain("to_regclass('public.event_requests')");
    expect(sql).toContain("to_regclass('public.sacramental_records')");
    expect(sql).toContain("to_regclass('public.mass_intentions')");
    expect(sql).toContain("to_regclass('public.event_registration_payments')");
    expect(sql).toContain("to_regclass('public.ministry_join_requests')");
    expect(sql).toContain("'total'");
    expect(sql).toContain("grant execute on function public.get_church_admin_pending_counts(uuid) to authenticated");
  });
});
