import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_SCHEDULER_HEARTBEAT_MS,
  ANALYTICS_SCHEDULER_MAX_CHURCHES,
  ANALYTICS_SCHEDULER_MAX_PAGES,
  ANALYTICS_SCHEDULER_PAGE_SIZE,
  orchestrateAnalyticsSnapshots,
  type AnalyticsSchedulerClient,
} from "../../supabase/functions/analytics-snapshots/orchestrator";

type RpcCall = {
  name: string;
  args?: Record<string, unknown>;
};

function ok<T>(data: T) {
  return { data, error: null };
}

function fail(message: string) {
  return { data: null, error: { message } };
}

function claim(runId: string, leaseOwner = `${runId}-owner`) {
  return ok({ claimed: true, run_id: runId, lease_owner: leaseOwner });
}

function page(input: {
  attempted: number;
  succeeded: number;
  failed: number;
  has_more: boolean;
  next_cursor: string | null;
  already_running?: boolean;
  results?: Array<Record<string, unknown>>;
}) {
  return {
    attempted: input.attempted,
    succeeded: input.succeeded,
    failed: input.failed,
    has_more: input.has_more,
    next_cursor: input.next_cursor,
    already_running: input.already_running ?? false,
    results: input.results ?? [],
  };
}

function clientFor(handler: (name: string, args?: Record<string, unknown>) => unknown): {
  client: AnalyticsSchedulerClient;
  calls: RpcCall[];
} {
  const calls: RpcCall[] = [];
  return {
    calls,
    client: {
      async rpc(name, args) {
        calls.push({ name, args });
        return handler(name, args) as never;
      },
    },
  };
}

describe("Wave 17 analytics scheduler orchestration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a single-page traversal and records a completed run", async () => {
    const { client, calls } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-1");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") {
        return ok(page({ attempted: 2, succeeded: 2, failed: 0, has_more: false, next_cursor: "church-2" }));
      }
      if (name === "record_analytics_automation_page") return ok({});
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    const result = await orchestrateAnalyticsSnapshots(client);

    expect(result).toMatchObject({
      success: true,
      status: "completed",
      pages_processed: 1,
      churches_attempted: 2,
      churches_succeeded: 2,
      churches_failed: 0,
      last_cursor: "church-2",
    });
    expect(calls.map((call) => call.name)).toEqual([
      "claim_analytics_automation_run",
      "renew_analytics_automation_run",
      "run_active_church_analytics_snapshot_generation",
      "record_analytics_automation_page",
      "finish_analytics_automation_run",
    ]);
    expect(calls[2].args).toMatchObject({ p_after_church_id: null, p_limit: ANALYTICS_SCHEDULER_PAGE_SIZE });
    expect(calls.find((call) => call.name === "record_analytics_automation_page")?.args).toMatchObject({
      p_run_id: "run-1",
      p_lease_owner: "run-1-owner",
    });
    expect(calls.find((call) => call.name === "finish_analytics_automation_run")?.args).toMatchObject({
      p_run_id: "run-1",
      p_lease_owner: "run-1-owner",
    });
  });

  it("traverses multiple pages sequentially using next_cursor", async () => {
    const pages = [
      page({ attempted: 25, succeeded: 24, failed: 1, has_more: true, next_cursor: "church-25" }),
      page({ attempted: 5, succeeded: 5, failed: 0, has_more: false, next_cursor: "church-30" }),
    ];
    const { client, calls } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-2");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") return ok(pages.shift());
      if (name === "record_analytics_automation_page") return ok({});
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    const result = await orchestrateAnalyticsSnapshots(client);

    expect(result).toMatchObject({
      success: true,
      pages_processed: 2,
      churches_attempted: 30,
      churches_succeeded: 29,
      churches_failed: 1,
      last_cursor: "church-30",
    });
    const batchCalls = calls.filter((call) => call.name === "run_active_church_analytics_snapshot_generation");
    expect(batchCalls.map((call) => call.args?.p_after_church_id)).toEqual([null, "church-25"]);
  });

  it("stops cleanly when another scheduler invocation already owns the run", async () => {
    const { client, calls } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") {
        return ok({ claimed: false, status: "already_running", run_id: "skipped-run" });
      }
      throw new Error(name);
    });

    const result = await orchestrateAnalyticsSnapshots(client);

    expect(result).toMatchObject({ success: true, status: "skipped", run_id: "skipped-run" });
    expect(calls).toHaveLength(1);
  });

  it("keeps church-level failures as page results and continues later pages", async () => {
    const pages = [
      page({
        attempted: 2,
        succeeded: 1,
        failed: 1,
        has_more: true,
        next_cursor: "church-2",
        results: [{ status: "failed", churchId: "church-2", errorCode: "P0001", message: "generation_failed" }],
      }),
      page({ attempted: 1, succeeded: 1, failed: 0, has_more: false, next_cursor: "church-3" }),
    ];
    const { client, calls } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-3");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") return ok(pages.shift());
      if (name === "record_analytics_automation_page") return ok({});
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    const result = await orchestrateAnalyticsSnapshots(client);

    expect(result).toMatchObject({ success: true, churches_attempted: 3, churches_succeeded: 2, churches_failed: 1 });
    expect(calls.filter((call) => call.name === "run_active_church_analytics_snapshot_generation")).toHaveLength(2);
    expect(calls.find((call) => call.name === "record_analytics_automation_page")?.args?.p_failures).toEqual([
      { churchId: "church-2", errorCode: "P0001", message: "generation_failed" },
    ]);
  });

  it("marks the run failed when a page RPC fails before cursor advances", async () => {
    const { client, calls } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-4");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") return fail("temporary page failure");
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    const result = await orchestrateAnalyticsSnapshots(client);

    expect(result).toMatchObject({ success: false, status: "failed", pages_processed: 0, last_cursor: null });
    expect(calls.at(-1)).toMatchObject({
      name: "finish_analytics_automation_run",
      args: {
        p_status: "failed",
        p_error_code: "orchestration_failed",
        p_error_message: "temporary page failure",
        p_lease_owner: "run-4-owner",
      },
    });
  });

  it("detects cursor non-progress, malformed responses, and maximum page bounds", async () => {
    const nonProgress = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-5");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") {
        return ok(page({ attempted: 1, succeeded: 1, failed: 0, has_more: true, next_cursor: null }));
      }
      if (name === "record_analytics_automation_page") return ok({});
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    await expect(orchestrateAnalyticsSnapshots(nonProgress.client)).resolves.toMatchObject({
      success: false,
      error: "Analytics scheduler cursor did not progress.",
    });

    const malformed = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-6");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") {
        return ok({ attempted: "many", next_cursor: null, results: [] });
      }
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    await expect(orchestrateAnalyticsSnapshots(malformed.client)).resolves.toMatchObject({
      success: false,
      error: "Malformed analytics batch response: attempted",
    });

    const bounded = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-7");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") {
        return ok(page({ attempted: 1, succeeded: 1, failed: 0, has_more: true, next_cursor: crypto.randomUUID() }));
      }
      if (name === "record_analytics_automation_page") return ok({});
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    await expect(orchestrateAnalyticsSnapshots(bounded.client, { maxPages: 1 })).resolves.toMatchObject({
      success: false,
      error: "Analytics scheduler maximum page bound reached.",
    });
  });

  it("enforces the maximum church safety bound", async () => {
    const { client } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-8");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") {
        return ok(page({ attempted: 2, succeeded: 2, failed: 0, has_more: true, next_cursor: crypto.randomUUID() }));
      }
      if (name === "record_analytics_automation_page") return ok({});
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    await expect(orchestrateAnalyticsSnapshots(client, { maxChurches: 1 })).resolves.toMatchObject({
      success: false,
      error: "Analytics scheduler maximum church bound reached.",
    });
  });

  it("keeps scheduler bounds explicit and does not leak service secrets in output", async () => {
    expect(ANALYTICS_SCHEDULER_PAGE_SIZE).toBe(25);
    expect(ANALYTICS_SCHEDULER_MAX_PAGES).toBe(100);
    expect(ANALYTICS_SCHEDULER_MAX_CHURCHES).toBe(2500);
    expect(ANALYTICS_SCHEDULER_HEARTBEAT_MS).toBe(5 * 60 * 1000);

    const { client } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-9");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") return fail("SUPABASE_SERVICE_ROLE_KEY=secret-value");
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    const result = await orchestrateAnalyticsSnapshots(client);

    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect(result.error).toBe("SUPABASE_SERVICE_ROLE_KEY=[redacted]");
  });

  it("heartbeats while a page RPC is pending and stops after completion", async () => {
    vi.useFakeTimers();
    let resolvePage: (value: unknown) => void = () => undefined;
    const pagePromise = new Promise((resolve) => {
      resolvePage = resolve;
    });
    const { client, calls } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-heartbeat");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") return pagePromise;
      if (name === "record_analytics_automation_page") return ok({});
      if (name === "finish_analytics_automation_run") return ok({});
      throw new Error(name);
    });

    const resultPromise = orchestrateAnalyticsSnapshots(client);
    await vi.advanceTimersByTimeAsync(ANALYTICS_SCHEDULER_HEARTBEAT_MS);

    expect(calls.filter((call) => call.name === "renew_analytics_automation_run")).toHaveLength(2);
    resolvePage(ok(page({ attempted: 1, succeeded: 1, failed: 0, has_more: false, next_cursor: "church-1" })));
    await expect(resultPromise).resolves.toMatchObject({ success: true, status: "completed" });

    const renewalsAfterCompletion = calls.filter((call) => call.name === "renew_analytics_automation_run").length;
    await vi.advanceTimersByTimeAsync(ANALYTICS_SCHEDULER_HEARTBEAT_MS);
    expect(calls.filter((call) => call.name === "renew_analytics_automation_run")).toHaveLength(renewalsAfterCompletion);
  });

  it("does not allow long pending pages to proceed when heartbeat loses ownership", async () => {
    vi.useFakeTimers();
    let resolvePage: (value: unknown) => void = () => undefined;
    const pagePromise = new Promise((resolve) => {
      resolvePage = resolve;
    });
    let renewalCount = 0;
    const { client, calls } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-lost");
      if (name === "renew_analytics_automation_run") {
        renewalCount += 1;
        return renewalCount === 1 ? ok({}) : fail("Analytics automation lease ownership was lost");
      }
      if (name === "run_active_church_analytics_snapshot_generation") return pagePromise;
      if (name === "finish_analytics_automation_run") return fail("Analytics automation lease ownership was lost");
      throw new Error(name);
    });

    const resultPromise = orchestrateAnalyticsSnapshots(client);
    await vi.advanceTimersByTimeAsync(ANALYTICS_SCHEDULER_HEARTBEAT_MS);

    await expect(resultPromise).resolves.toMatchObject({
      success: false,
      status: "failed",
      pages_processed: 0,
      error: "Analytics automation lease ownership was lost",
    });
    resolvePage(ok(page({ attempted: 1, succeeded: 1, failed: 0, has_more: false, next_cursor: "church-1" })));
    expect(calls.some((call) => call.name === "record_analytics_automation_page")).toBe(false);
    expect(calls.filter((call) => call.name === "run_active_church_analytics_snapshot_generation")).toHaveLength(1);
  });

  it("stops before the next page when ownership is lost after page completion", async () => {
    const { client, calls } = clientFor((name) => {
      if (name === "claim_analytics_automation_run") return claim("run-record-lost");
      if (name === "renew_analytics_automation_run") return ok({});
      if (name === "run_active_church_analytics_snapshot_generation") {
        return ok(page({ attempted: 1, succeeded: 1, failed: 0, has_more: true, next_cursor: "church-1" }));
      }
      if (name === "record_analytics_automation_page") return fail("Analytics automation lease ownership was lost");
      if (name === "finish_analytics_automation_run") return fail("Analytics automation lease ownership was lost");
      throw new Error(name);
    });

    await expect(orchestrateAnalyticsSnapshots(client)).resolves.toMatchObject({
      success: false,
      status: "failed",
      pages_processed: 0,
      error: "Analytics automation lease ownership was lost",
    });
    expect(calls.filter((call) => call.name === "run_active_church_analytics_snapshot_generation")).toHaveLength(1);
  });
});
