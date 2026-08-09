import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("RC-7.3 production operations", () => {
  const migration = read("supabase/migrations/20260708135000_rc73_operations.sql");
  const healthFunction = read("supabase/functions/operations-health/index.ts");
  const metricsFunction = read("supabase/functions/operations-metrics/index.ts");
  const workerFunction = read("supabase/functions/audio-worker/index.ts");
  const memberAudioFunction = read("supabase/functions/member-audio/index.ts");
  const operationsPage = read("src/pages/church-admin/OperationsPage.tsx");
  const routes = read("src/routes/AdminRoutes.tsx");
  const registry = read("src/components/workspace/registry.ts");
  const smoke = read("scripts/ops/post-deployment-smoke.mjs");

  it("adds additive operations schema, metrics, health, and heartbeats", () => {
    expect(migration).toContain("create table if not exists public.operational_events");
    expect(migration).toContain("create table if not exists public.audio_worker_heartbeats");
    expect(migration).toContain("get_audio_operations_metrics");
    expect(migration).toContain("get_audio_operations_health");
    expect(migration).toContain("record_audio_worker_heartbeat");
    expect(migration).toContain("log_audio_job_operational_events");
  });

  it("exposes health and metrics Edge Functions", () => {
    expect(healthFunction).toContain("Database connectivity verified");
    expect(healthFunction).toContain("Audio storage bucket is reachable");
    expect(healthFunction).toContain("operations-metrics");
    expect(metricsFunction).toContain("get_audio_operations_metrics");
  });

  it("authorizes tenant metrics through the operations view permission before service-role access", () => {
    expect(metricsFunction).toMatch(/userClient\.rpc\(\s*["']has_church_feature_permission["']/);
    expect(metricsFunction).toMatch(/_user_id:\s*user\.id/);
    expect(metricsFunction).toMatch(/_church_id:\s*churchId/);
    expect(metricsFunction).toMatch(/_feature_key:\s*["']operations["']/);
    expect(metricsFunction).toMatch(/_action:\s*["']view["']/);
    expect(metricsFunction).not.toContain("can_manage_church_workspace");

    expect(metricsFunction).toMatch(
      /if\s*\(\s*!canManage\s*\)\s*return\s+jsonResponse\(\s*403\s*,\s*\{\s*error:\s*["']Operations access required\.["']\s*\}\s*\)/,
    );

    const authenticationIndex = metricsFunction.indexOf("userClient.auth.getUser()");
    const permissionIndex = metricsFunction.indexOf('userClient.rpc("has_church_feature_permission"');
    const denialIndex = metricsFunction.indexOf("if (!canManage)");
    const serviceClientIndex = metricsFunction.indexOf("const serviceClient");
    const metricsQueryIndex = metricsFunction.indexOf('serviceClient.rpc("get_audio_operations_metrics"');

    expect(authenticationIndex).toBeGreaterThanOrEqual(0);
    expect(permissionIndex).toBeGreaterThan(authenticationIndex);
    expect(denialIndex).toBeGreaterThan(permissionIndex);
    expect(serviceClientIndex).toBeGreaterThan(denialIndex);
    expect(metricsQueryIndex).toBeGreaterThan(serviceClientIndex);
  });

  it("centralizes operational events without changing worker business flow", () => {
    expect(workerFunction).toContain("record_audio_worker_heartbeat");
    expect(workerFunction).toContain("log_operational_event");
    expect(workerFunction).toContain("audio worker operational log skipped");
    expect(memberAudioFunction).toContain("playback_failure");
    expect(memberAudioFunction).toContain("Signed playback URL creation failed");
  });

  it("adds an admin Operations page and navigation route", () => {
    expect(operationsPage).toContain("Queue Length");
    expect(operationsPage).toContain("Worker Heartbeat");
    expect(operationsPage).toContain("Python Worker Heartbeat");
    expect(operationsPage).toContain("Operational Events");
    expect(routes).toContain('path="operations"');
    expect(registry).toContain('to: "/church-admin/operations"');
  });

  it("ships production operations docs and post-deployment smoke tests", () => {
    expect(read("docs/BACKUP_AND_RECOVERY.md")).toContain("Audio index restore");
    expect(read("docs/PRODUCTION_DEPLOYMENT.md")).toContain("Supabase Secrets");
    expect(read("docs/RUNBOOK.md")).toContain("Worker Stuck");
    expect(read("docs/RC73_RELEASE_CHECKLIST.md")).toContain("Monitoring");
    expect(smoke).toContain("operations-health");
    expect(smoke).toContain("member-audio");
    expect(smoke).toContain("SMOKE_MUTATE=true");
  });
});
