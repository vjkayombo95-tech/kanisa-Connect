import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = [
  "supabase/migrations/20260915110000_add_service_analytics_snapshot_runner.sql",
  "supabase/migrations/20260915120000_bound_service_analytics_snapshot_runner.sql",
  "supabase/migrations/20260915130000_add_analytics_scheduler_observability.sql",
  "supabase/migrations/20260915140000_harden_analytics_scheduler_lease_ownership.sql",
]
  .map((path) => readFileSync(join(root, path), "utf8"))
  .join("\n");
const normalized = migration.replace(/\s+/g, " ").toLowerCase();
const edgeFunction = readFileSync(join(root, "supabase/functions/analytics-snapshots/index.ts"), "utf8");
const edgeHandler = readFileSync(join(root, "supabase/functions/analytics-snapshots/handler.ts"), "utf8");
const orchestrator = readFileSync(join(root, "supabase/functions/analytics-snapshots/orchestrator.ts"), "utf8");

function functionBody(functionName: string) {
  const matches = Array.from(
    migration.matchAll(
      new RegExp(`create or replace function public\\.${functionName}\\s*\\([\\s\\S]*?\\n\\$\\$;`, "gi"),
    ),
  );

  return matches.at(-1)?.[0] ?? "";
}

describe("Wave 17 analytics service runner", () => {
  const serviceFunction = functionBody("generate_church_analytics_snapshot_as_service");
  const batchFunction = functionBody("run_active_church_analytics_snapshot_generation");

  it("guards both service functions with auth.role() service_role checks", () => {
    for (const body of [serviceFunction, batchFunction]) {
      expect(body).toContain("security definer");
      expect(body).toContain("set search_path = public, pg_temp");
      expect(body).toContain("coalesce(auth.role(), '') <> 'service_role'");
      expect(body).toContain("using errcode = '42501'");
    }
  });

  it("keeps single-church service generation active-only and delegates to the internal core", () => {
    expect(serviceFunction).toContain("from public.churches c");
    expect(serviceFunction).toContain("where c.id = p_church_id");
    expect(serviceFunction).toContain("if v_church_status <> 'active' then");
    expect(serviceFunction).toContain("return public.generate_church_analytics_snapshot_internal(p_church_id, null)");
    expect(serviceFunction).not.toContain("public.enforce_rate_limit");
  });

  it("keeps batch generation active-only with per-church exception isolation", () => {
    expect(batchFunction).toContain("p_after_church_id uuid default null");
    expect(batchFunction).toContain("p_limit integer default 25");
    expect(batchFunction).toContain("v_max_limit constant integer := 100");
    expect(batchFunction).toContain("least(greatest(coalesce(p_limit, v_default_limit), 1), v_max_limit)");
    expect(batchFunction).toContain("pg_try_advisory_xact_lock");
    expect(batchFunction).toContain("hashtextextended('run_active_church_analytics_snapshot_generation', 0)");
    expect(batchFunction).toContain("where c.status = 'active'");
    expect(batchFunction).toContain("p_after_church_id is null or c.id > p_after_church_id");
    expect(batchFunction).toContain("order by c.id");
    expect(batchFunction).toContain("limit v_effective_limit + 1");
    expect(batchFunction).toContain("public.generate_church_analytics_snapshot_as_service(v_church.id)");
    expect(batchFunction).toContain("exception");
    expect(batchFunction).toContain("when others then");
    expect(batchFunction).toContain("'attempted'");
    expect(batchFunction).toContain("'succeeded'");
    expect(batchFunction).toContain("'failed'");
    expect(batchFunction).toContain("'has_more'");
    expect(batchFunction).toContain("'next_cursor'");
    expect(batchFunction).toContain("'effective_limit'");
    expect(batchFunction).toContain("'already_running'");
    expect(batchFunction).toContain("'errorCode'");
    expect(batchFunction).toContain("'generation_failed'");
    expect(batchFunction).not.toContain("sqlerrm");
  });

  it("grants execution only to service_role", () => {
    for (const signature of [
      "public.generate_church_analytics_snapshot_as_service(uuid)",
      "public.run_active_church_analytics_snapshot_generation(uuid, integer)",
    ]) {
      expect(normalized).toContain(`revoke all on function ${signature} from public`);
      expect(normalized).toContain(`revoke all on function ${signature} from anon`);
      expect(normalized).toContain(`revoke all on function ${signature} from authenticated`);
      expect(normalized).toContain(`grant execute on function ${signature} to service_role`);
    }

    expect(normalized).toContain(
      "revoke all on function public.generate_church_analytics_snapshot_internal(uuid, uuid) from service_role",
    );
  });

  it("does not introduce scheduler, billing eligibility, or snapshot mutation semantics", () => {
    expect(normalized).not.toMatch(/cron\.schedule|pg_cron|net\.http|daily-automations/);
    expect(normalized).not.toMatch(/subscription|billing|plan|entitlement/);
    expect(`${serviceFunction}\n${batchFunction}`.toLowerCase()).not.toMatch(
      /on conflict|upsert|update public\.analytics_snapshots|delete from public\.analytics_snapshots/,
    );
  });

  it("adds service-only scheduler observability without enabling a remote schedule", () => {
    expect(normalized).toContain("create table if not exists public.analytics_automation_runs");
    expect(normalized).toContain("lease_expires_at");
    expect(normalized).toContain("lease_owner uuid");
    expect(normalized).toContain("heartbeat_at timestamptz");
    expect(normalized).toContain("status in ('running', 'completed', 'failed', 'skipped')");
    expect(normalized).toContain("alter table public.analytics_automation_runs enable row level security");
    expect(normalized).toContain("revoke all on table public.analytics_automation_runs from public");
    expect(normalized).toContain("revoke all on table public.analytics_automation_runs from anon");
    expect(normalized).toContain("revoke all on table public.analytics_automation_runs from authenticated");
    expect(normalized).toContain("grant select, insert, update on table public.analytics_automation_runs to service_role");
    expect(normalized).toContain("public.claim_analytics_automation_run");
    expect(normalized).toContain("public.renew_analytics_automation_run");
    expect(normalized).toContain("public.record_analytics_automation_page");
    expect(normalized).toContain("public.finish_analytics_automation_run");
    expect(normalized).toContain("hashtextextended('claim_analytics_automation_run', 0)");
    expect(normalized).toContain("and lease_owner = p_lease_owner");
    expect(normalized).toContain("drop function if exists public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, interval)");
    expect(normalized).toContain("drop function if exists public.finish_analytics_automation_run(uuid, text, text, text)");
    expect(normalized).toContain("'daily at 02:00 local operational time'");
    expect(normalized).toContain("false ) on conflict (job_name) do nothing");
  });

  it("keeps the Edge Function on the existing service-role credential pattern", () => {
    expect(edgeFunction).toContain("handleAnalyticsSnapshotsRequest");
    expect(edgeHandler).toContain('dependencies.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(edgeHandler).toContain("bearerToken === serviceRoleKey");
    expect(edgeHandler).toContain('callerSupabase.rpc("is_super_admin")');
    expect(edgeHandler).toContain("dependencies.createClient(supabaseUrl, serviceRoleKey");
    expect(edgeHandler).toContain("orchestrateAnalyticsSnapshots");
    expect(edgeFunction).not.toContain("cron.schedule");
    expect(edgeFunction).not.toContain("pg_cron");
    expect(orchestrator).toContain("ANALYTICS_SCHEDULER_PAGE_SIZE = 25");
    expect(orchestrator).toContain("ANALYTICS_SCHEDULER_MAX_PAGES = 100");
    expect(orchestrator).toContain("ANALYTICS_SCHEDULER_MAX_CHURCHES = 2500");
    expect(orchestrator).toContain("ANALYTICS_SCHEDULER_HEARTBEAT_MS = 5 * 60 * 1000");
    expect(orchestrator).toContain('client.rpc("renew_analytics_automation_run"');
    expect(orchestrator).toContain("p_lease_owner: leaseOwner");
  });
});
