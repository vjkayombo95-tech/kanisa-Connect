import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260915100000_extract_analytics_snapshot_core.sql"),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").toLowerCase();
const analyticsSnapshots = readFileSync(join(root, "src/lib/analytics-snapshots.ts"), "utf8");

function functionBody(functionName: string) {
  const match = migration.match(
    new RegExp(`create or replace function public\\.${functionName}\\s*\\([\\s\\S]*?\\n\\$\\$;`, "i"),
  );

  return match?.[0] ?? "";
}

describe("Wave 17 analytics snapshot reusable core", () => {
  const internalFunction = functionBody("generate_church_analytics_snapshot_internal");
  const manualFunction = functionBody("generate_church_analytics_snapshot");

  it("creates one locked reusable internal generator with the existing analytics payload", () => {
    expect(internalFunction).toContain("returns public.analytics_snapshots");
    expect(internalFunction).toContain("security definer");
    expect(internalFunction).toContain("set search_path = public, pg_temp");
    expect(internalFunction).toContain("p_generated_by uuid default null");

    for (const key of [
      "'generatedAt'",
      "'thisTotal'",
      "'lastTotal'",
      "'totalContributions'",
      "'transactionCount'",
      "'categoryCount'",
      "'overallChange'",
      "'activeMembers'",
      "'newMembers'",
      "'pledgeTotals'",
      "'monthlyContributions'",
      "'trendData'",
      "'topCategories'",
      "'categoryComparison'",
      "'recentTrends'",
      "'jumuiyaData'",
    ]) {
      expect(internalFunction).toContain(key);
    }
  });

  it("keeps authorization and rate limiting in the manual browser/admin RPC", () => {
    expect(manualFunction).toContain("v_user_id uuid := auth.uid()");
    expect(manualFunction).toContain("if v_user_id is null then");
    expect(manualFunction).toContain("raise exception 'Authentication required.' using errcode = '42501'");
    expect(manualFunction).toContain("ur.user_id = v_user_id");
    expect(manualFunction).toContain("ur.church_id = p_church_id");
    expect(manualFunction).toContain("ur.role in ('church_admin', 'pastor', 'admin')");
    expect(manualFunction).toContain(
      "perform public.enforce_rate_limit('analytics_snapshot', p_church_id::text, 3, interval '1 hour')",
    );
  });

  it("delegates manual generation to the internal generator after checks", () => {
    expect(manualFunction.indexOf("ur.role in ('church_admin', 'pastor', 'admin')")).toBeLessThan(
      manualFunction.indexOf("public.generate_church_analytics_snapshot_internal(p_church_id, v_user_id)"),
    );
    expect(manualFunction.indexOf("public.enforce_rate_limit")).toBeLessThan(
      manualFunction.indexOf("public.generate_church_analytics_snapshot_internal(p_church_id, v_user_id)"),
    );
    expect(manualFunction).toContain("return public.generate_church_analytics_snapshot_internal(p_church_id, v_user_id)");
  });

  it("does not expose the internal generator through public, anon, or authenticated execute grants", () => {
    expect(normalized).toContain(
      "revoke all on function public.generate_church_analytics_snapshot_internal(uuid, uuid) from public",
    );
    expect(normalized).toContain(
      "revoke all on function public.generate_church_analytics_snapshot_internal(uuid, uuid) from anon",
    );
    expect(normalized).toContain(
      "revoke all on function public.generate_church_analytics_snapshot_internal(uuid, uuid) from authenticated",
    );
    expect(normalized).not.toMatch(/grant execute on function public\.generate_church_analytics_snapshot_internal/i);
  });

  it("keeps the manual RPC callable only through authenticated users and its own internal authorization", () => {
    expect(normalized).toContain("revoke all on function public.generate_church_analytics_snapshot(uuid) from public");
    expect(normalized).toContain("revoke all on function public.generate_church_analytics_snapshot(uuid) from anon");
    expect(normalized).toContain("grant execute on function public.generate_church_analytics_snapshot(uuid) to authenticated");
    expect(normalized).not.toMatch(/grant execute on function public\.generate_church_analytics_snapshot\(uuid\) to service_role/i);
  });

  it("preserves append-only insert behavior and generated_by semantics", () => {
    expect(internalFunction).toContain("insert into public.analytics_snapshots");
    expect(internalFunction).toContain("generated_by");
    expect(internalFunction).toContain("p_generated_by");
    expect(internalFunction).toContain("returning * into v_snapshot");
    expect(internalFunction).not.toMatch(/on conflict|upsert|update public\.analytics_snapshots/i);
    expect(manualFunction).toContain("public.generate_church_analytics_snapshot_internal(p_church_id, v_user_id)");
  });

  it("leaves the existing latest-snapshot frontend contract unchanged", () => {
    expect(analyticsSnapshots).toContain('order("generated_at", { ascending: false })');
    expect(analyticsSnapshots).toContain(".limit(1)");
    expect(analyticsSnapshots).toContain(".maybeSingle()");
    expect(analyticsSnapshots).toContain('supabase.rpc("generate_church_analytics_snapshot"');
  });

  it("does not introduce Slice 2 batch, scheduler, cron, or Edge Function automation", () => {
    expect(normalized).not.toMatch(/generate_all_church|batch|cron\.schedule|pg_cron|net\.http|edge function/);
    expect(normalized).not.toContain("run_daily_automations");
    expect(normalized).not.toContain("service_role");
  });
});
