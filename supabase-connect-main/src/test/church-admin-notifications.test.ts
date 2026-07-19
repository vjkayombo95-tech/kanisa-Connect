import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHURCH_ADMIN_NOTIFICATION_REFRESH_MS,
  getActionRequiredItems,
  getChurchAdminNotificationItems,
  getChurchAdminSidebarBadge,
  normalizeChurchAdminPendingCounts,
  useChurchAdminRealtimeNotifications,
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
      prayerRequests: 2,
      communityHelp: 1,
      invitations: 2,
      announcements: 1,
      payments: "4",
      memberships: null,
      volunteers: undefined,
    });

    expect(counts).toEqual({
      events: 2,
      sacraments: 1,
      massIntentions: 3,
      prayerRequests: 2,
      communityHelp: 1,
      invitations: 2,
      announcements: 1,
      payments: 4,
      memberships: 0,
      volunteers: 0,
      total: 16,
    });
  });

  it("maps action queues to the church admin pages that resolve them", () => {
    const counts = normalizeChurchAdminPendingCounts({
      events: 1,
      sacraments: 0,
      massIntentions: 2,
      prayerRequests: 1,
      communityHelp: 1,
      invitations: 1,
      announcements: 1,
      payments: 1,
      memberships: 1,
      volunteers: 1,
    });
    const actionItems = getActionRequiredItems(counts);

    expect(actionItems.map((item) => [item.key, item.route, item.count])).toEqual([
      ["events", "/church-admin/event-requests", 1],
      ["massIntentions", "/church-admin/mass-intentions", 2],
      ["prayerRequests", "/church-admin/prayer-requests", 1],
      ["communityHelp", "/church-admin/community-help", 1],
      ["invitations", "/church-admin/roles", 1],
      ["announcements", "/church-admin/announcements", 1],
      ["payments", "/church-admin/events", 1],
      ["memberships", "/church-admin/communities", 1],
      ["volunteers", "/church-admin/ministries", 1],
    ]);
    expect(getChurchAdminNotificationItems(counts)).toHaveLength(10);
  });

  it("maps sidebar menu ids to red badge counts", () => {
    const counts = normalizeChurchAdminPendingCounts({
      events: 5,
      sacraments: 4,
      massIntentions: 3,
      prayerRequests: 7,
      communityHelp: 8,
      invitations: 9,
      announcements: 10,
      payments: 2,
      memberships: 1,
      volunteers: 6,
    });

    expect(getChurchAdminSidebarBadge("event-requests", counts)).toBe(5);
    expect(getChurchAdminSidebarBadge("sacraments", counts)).toBe(4);
    expect(getChurchAdminSidebarBadge("mass-intentions", counts)).toBe(3);
    expect(getChurchAdminSidebarBadge("prayer-requests", counts)).toBe(7);
    expect(getChurchAdminSidebarBadge("community-help", counts)).toBe(8);
    expect(getChurchAdminSidebarBadge("roles", counts)).toBe(9);
    expect(getChurchAdminSidebarBadge("announcements", counts)).toBe(10);
    expect(getChurchAdminSidebarBadge("events", counts)).toBe(2);
    expect(getChurchAdminSidebarBadge("qr-payments", counts)).toBe(2);
    expect(getChurchAdminSidebarBadge("communities", counts)).toBe(1);
    expect(getChurchAdminSidebarBadge("ministries", counts)).toBe(6);
    expect(getChurchAdminSidebarBadge("reports", counts)).toBe(0);
  });

  it("uses realtime notifications with a short polling fallback", () => {
    expect(CHURCH_ADMIN_NOTIFICATION_REFRESH_MS).toBe(15_000);
    expect(typeof useChurchAdminRealtimeNotifications).toBe("function");
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

  it("expands the aggregate RPC to every visible admin work queue", () => {
    const sql = migration("20260713124500_expand_admin_realtime_work_queue.sql");
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain("create or replace function public.get_church_admin_pending_counts");
    expect(sql).toContain("set search_path = public, pg_temp");
    expect(normalizedSql).toContain(
      "revoke all on function public.get_church_admin_pending_counts(uuid) from public, anon;",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.get_church_admin_pending_counts(uuid) to authenticated;",
    );
    expect(sql).toContain("pg_catalog.to_regclass(pg_catalog.format('%I.%I'");
    expect(sql).toContain("from pg_catalog.pg_attribute a");
    expect(sql).toContain("a.attname::text = any(v_required_columns)");
    expect(sql).toContain("and not a.attisdropped");
    expect(sql).toContain("into v_count using _church_id");
    expect(sql).toContain("'prayerRequests'");
    expect(sql).toContain("'communityHelp'");
    expect(sql).toContain("'invitations'");
    expect(sql).toContain("'announcements'");
    expect(sql).toContain("public.can_manage_church_roles(auth.uid(), _church_id)");
    expect(sql).toContain("public.can_manage_church_workspace(auth.uid(), _church_id)");
    expect(sql).toContain("foreach v_table_name in array array['community_join_requests', 'community_membership_requests']");
    expect(sql).toContain("foreach v_table_name in array array['ministry_join_requests', 'volunteer_requests']");
    expect(sql).toContain("v_memberships := v_memberships + coalesce(v_count, 0)");
    expect(sql).toContain("v_volunteers := v_volunteers + coalesce(v_count, 0)");
    expect(sql).toContain("from pg_catalog.pg_publication_tables");
    expect(sql).toContain("'alter publication %I add table %I.%I'");
    expect(sql).toContain("Tables created after this migration require a later migration to add them to realtime.");
    expect(normalizedSql).not.toMatch(/\b(drop table|drop column|drop policy|truncate table|delete from)\b/);
  });

  it("uses explicit lint-safe optional source guards in the forward fix", () => {
    const sql = migration("20260719201500_fix_admin_pending_counts_optional_sources_lint.sql");
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, " ");

    expect(normalizedSql).toContain(
      "create or replace function public.get_church_admin_pending_counts(_church_id uuid) returns jsonb",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, pg_temp");
    expect(normalizedSql).toContain(
      "revoke all on function public.get_church_admin_pending_counts(uuid) from public, anon;",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.get_church_admin_pending_counts(uuid) to authenticated;",
    );

    for (const table of [
      "community_join_requests",
      "community_membership_requests",
      "ministry_join_requests",
      "volunteer_requests",
    ]) {
      expect(sql).toContain(`pg_catalog.to_regclass('public.${table}')`);
      expect(sql).toContain(`'public', '${table}'`);
    }

    expect(sql).toContain("from pg_catalog.pg_attribute a");
    expect(sql).toContain("a.attname::text = any(v_required_columns)");
    expect(sql).toContain("into v_count using _church_id");
    expect(sql).toContain("v_relation::oid is distinct from v_first_membership_relation");
    expect(sql).toContain("v_relation::oid is distinct from v_first_volunteer_relation");
    expect(normalizedSql).not.toContain("foreach");
    expect(normalizedSql).not.toContain("elsif");
    expect(normalizedSql).not.toMatch(/array\[[^\]]*(community_join_requests|community_membership_requests|ministry_join_requests|volunteer_requests)/);
    expect(normalizedSql).not.toMatch(/\b(drop table|drop column|drop policy|truncate table|delete from)\b/);
    expect(normalizedSql).not.toMatch(/supabase_migrations\.schema_migrations/);
  });

  it("keeps absent optional relations opaque to lint via catalog-derived identifiers", () => {
    const sql = migration("20260719204500_fix_admin_pending_counts_catalog_identifiers.sql");
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, " ");

    expect(sql).toContain("create or replace function public._count_church_admin_pending_source");
    expect(sql).toContain("from pg_catalog.pg_class c");
    expect(sql).toContain("join pg_catalog.pg_namespace n");
    expect(sql).toContain("v_schema_name,");
    expect(sql).toContain("v_relation_name,");
    expect(sql).toContain("v_predicate");
    expect(sql).toContain("into v_count using _church_id");
    expect(normalizedSql).toContain(
      "revoke all on function public._count_church_admin_pending_source(regclass, uuid, text[], text) from public, anon, authenticated;",
    );
    expect(normalizedSql).toContain(
      "create or replace function public.get_church_admin_pending_counts(_church_id uuid) returns jsonb",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, pg_temp");
    expect(normalizedSql).toContain(
      "revoke all on function public.get_church_admin_pending_counts(uuid) from public, anon;",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.get_church_admin_pending_counts(uuid) to authenticated;",
    );

    for (const table of [
      "community_join_requests",
      "community_membership_requests",
      "ministry_join_requests",
      "volunteer_requests",
    ]) {
      expect(sql).toContain(`v_relation := pg_catalog.to_regclass('public.${table}')`);
    }

    expect(sql).toContain("v_relation::oid is distinct from v_first_membership_relation");
    expect(sql).toContain("v_relation::oid is distinct from v_first_volunteer_relation");
    expect(normalizedSql).not.toContain("foreach");
    expect(normalizedSql).not.toContain("elsif");
    expect(normalizedSql).not.toMatch(/array\[[^\]]*(community_join_requests|community_membership_requests|ministry_join_requests|volunteer_requests)/);
    expect(normalizedSql).not.toMatch(/\b(drop table|drop column|drop policy|truncate table|delete from)\b/);
    expect(normalizedSql).not.toMatch(/supabase_migrations\.schema_migrations/);
  });
});
