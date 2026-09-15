export type RpcResult<T> = {
  data: T | null;
  error: { message?: string; code?: string } | null;
};

export type AnalyticsSchedulerClient = {
  rpc: <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<RpcResult<T>>;
};

export type BatchPage = {
  attempted: number;
  succeeded: number;
  failed: number;
  has_more: boolean;
  next_cursor: string | null;
  already_running: boolean;
  results: Array<Record<string, unknown>>;
};

export type AnalyticsOrchestrationResult = {
  success: boolean;
  status: "completed" | "failed" | "skipped";
  run_id: string | null;
  pages_processed: number;
  churches_attempted: number;
  churches_succeeded: number;
  churches_failed: number;
  last_cursor: string | null;
  error: string | null;
};

export const ANALYTICS_SCHEDULER_PAGE_SIZE = 25;
export const ANALYTICS_SCHEDULER_MAX_PAGES = 100;
export const ANALYTICS_SCHEDULER_MAX_CHURCHES = 2500;
export const ANALYTICS_SCHEDULER_LEASE = "15 minutes";
export const ANALYTICS_SCHEDULER_HEARTBEAT_MS = 5 * 60 * 1000;

function errorMessage(error: unknown) {
  if (typeof error === "string") return error;

  return error instanceof Error ? error.message : "Analytics snapshot orchestration failed.";
}

export function sanitizeAnalyticsAutomationError(error: unknown) {
  return errorMessage(error)
    .replace(/(SUPABASE_SERVICE_ROLE_KEY\s*=\s*)\S+/gi, "$1[redacted]")
    .replace(/(service[_-]?role[_-]?key\s*[:=]\s*)\S+/gi, "$1[redacted]")
    .slice(0, 240);
}

function assertNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Malformed analytics batch response: ${label}`);
  }

  return value;
}

function assertBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Malformed analytics batch response: ${label}`);
  }

  return value;
}

function parseBatchPage(value: unknown): BatchPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Malformed analytics batch response.");
  }

  const page = value as Record<string, unknown>;
  const nextCursor = page.next_cursor;
  const results = page.results;

  if (nextCursor !== null && typeof nextCursor !== "string") {
    throw new Error("Malformed analytics batch response: next_cursor");
  }

  if (!Array.isArray(results)) {
    throw new Error("Malformed analytics batch response: results");
  }

  return {
    attempted: assertNumber(page.attempted, "attempted"),
    succeeded: assertNumber(page.succeeded, "succeeded"),
    failed: assertNumber(page.failed, "failed"),
    has_more: assertBoolean(page.has_more, "has_more"),
    next_cursor: nextCursor as string | null,
    already_running: assertBoolean(page.already_running, "already_running"),
    results: results as Array<Record<string, unknown>>,
  };
}

function boundedFailures(results: Array<Record<string, unknown>>) {
  return results
    .filter((result) => result.status === "failed")
    .slice(0, 25)
    .map((result) => ({
      churchId: typeof result.churchId === "string" ? result.churchId : null,
      errorCode: typeof result.errorCode === "string" ? result.errorCode.slice(0, 80) : "unknown",
      message: typeof result.message === "string" ? result.message.slice(0, 80) : "generation_failed",
    }));
}

async function finishRun(
  client: AnalyticsSchedulerClient,
  runId: string,
  leaseOwner: string,
  status: "completed" | "failed",
  errorCode: string | null,
  error: string | null,
) {
  const { error: finishError } = await client.rpc("finish_analytics_automation_run", {
    p_run_id: runId,
    p_status: status,
    p_error_code: errorCode,
    p_error_message: error,
    p_lease_owner: leaseOwner,
  });

  if (finishError) {
    throw new Error(finishError.message ?? "Failed to finish analytics automation run.");
  }
}

async function renewRun(client: AnalyticsSchedulerClient, runId: string, leaseOwner: string, leaseDuration: string) {
  const { error } = await client.rpc("renew_analytics_automation_run", {
    p_run_id: runId,
    p_lease_owner: leaseOwner,
    p_lease_duration: leaseDuration,
  });

  if (error) {
    throw new Error(error.message ?? "Analytics automation lease ownership was lost.");
  }
}

async function withHeartbeat<T>(
  task: Promise<T>,
  renew: () => Promise<void>,
  heartbeatIntervalMs: number,
): Promise<T> {
  let rejectHeartbeatFailure: ((error: Error) => void) | null = null;
  const heartbeatFailure = new Promise<never>((_, reject) => {
    rejectHeartbeatFailure = reject;
  });

  const heartbeat = setInterval(() => {
    void renew().catch((error) => {
      rejectHeartbeatFailure?.(
        error instanceof Error ? error : new Error("Analytics automation lease renewal failed."),
      );
    });
  }, heartbeatIntervalMs);

  try {
    return await Promise.race([task, heartbeatFailure]);
  } finally {
    rejectHeartbeatFailure = null;
    clearInterval(heartbeat);
  }
}

export async function orchestrateAnalyticsSnapshots(
  client: AnalyticsSchedulerClient,
  options: {
    invocationSource?: string;
    pageSize?: number;
    maxPages?: number;
    maxChurches?: number;
    leaseDuration?: string;
    heartbeatIntervalMs?: number;
  } = {},
): Promise<AnalyticsOrchestrationResult> {
  const pageSize = options.pageSize ?? ANALYTICS_SCHEDULER_PAGE_SIZE;
  const maxPages = options.maxPages ?? ANALYTICS_SCHEDULER_MAX_PAGES;
  const maxChurches = options.maxChurches ?? ANALYTICS_SCHEDULER_MAX_CHURCHES;
  const leaseDuration = options.leaseDuration ?? ANALYTICS_SCHEDULER_LEASE;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? ANALYTICS_SCHEDULER_HEARTBEAT_MS;

  const claim = await client.rpc<Record<string, unknown>>("claim_analytics_automation_run", {
    p_invocation_source: options.invocationSource ?? "scheduler",
    p_lease_duration: leaseDuration,
  });

  if (claim.error) {
    throw new Error(claim.error.message ?? "Failed to claim analytics automation run.");
  }

  const claimData = claim.data ?? {};
  const runId = typeof claimData.run_id === "string" ? claimData.run_id : null;
  const leaseOwner = typeof claimData.lease_owner === "string" ? claimData.lease_owner : null;

  if (claimData.claimed !== true) {
    return {
      success: true,
      status: "skipped",
      run_id: runId,
      pages_processed: 0,
      churches_attempted: 0,
      churches_succeeded: 0,
      churches_failed: 0,
      last_cursor: null,
      error: null,
    };
  }

  if (!runId || !leaseOwner) {
    throw new Error("Malformed analytics run claim response: run_id or lease_owner");
  }

  let cursor: string | null = null;
  let pagesProcessed = 0;
  let churchesAttempted = 0;
  let churchesSucceeded = 0;
  let churchesFailed = 0;

  try {
    while (true) {
      if (pagesProcessed >= maxPages) {
        throw new Error("Analytics scheduler maximum page bound reached.");
      }

      if (churchesAttempted >= maxChurches) {
        throw new Error("Analytics scheduler maximum church bound reached.");
      }

      await renewRun(client, runId, leaseOwner, leaseDuration);

      const pageResponse = await withHeartbeat(
        client.rpc<unknown>("run_active_church_analytics_snapshot_generation", {
          p_after_church_id: cursor,
          p_limit: pageSize,
        }),
        () => renewRun(client, runId, leaseOwner, leaseDuration),
        heartbeatIntervalMs,
      );

      if (pageResponse.error) {
        throw new Error(pageResponse.error.message ?? "Analytics batch page failed.");
      }

      const page = parseBatchPage(pageResponse.data);

      if (page.already_running) {
        throw new Error("Analytics batch page reported an overlapping run.");
      }

      const progressResponse = await client.rpc("record_analytics_automation_page", {
        p_run_id: runId,
        p_attempted: page.attempted,
        p_succeeded: page.succeeded,
        p_failed: page.failed,
        p_last_cursor: page.next_cursor,
        p_failures: boundedFailures(page.results),
        p_lease_owner: leaseOwner,
        p_lease_duration: leaseDuration,
      });

      if (progressResponse.error) {
        throw new Error(progressResponse.error.message ?? "Failed to record analytics automation progress.");
      }

      pagesProcessed += 1;
      churchesAttempted += page.attempted;
      churchesSucceeded += page.succeeded;
      churchesFailed += page.failed;

      if (!page.has_more) {
        cursor = page.next_cursor;
        break;
      }

      if (!page.next_cursor || page.next_cursor === cursor) {
        throw new Error("Analytics scheduler cursor did not progress.");
      }

      cursor = page.next_cursor;
    }

    await finishRun(client, runId, leaseOwner, "completed", null, null);

    return {
      success: true,
      status: "completed",
      run_id: runId,
      pages_processed: pagesProcessed,
      churches_attempted: churchesAttempted,
      churches_succeeded: churchesSucceeded,
      churches_failed: churchesFailed,
      last_cursor: cursor,
      error: null,
    };
  } catch (error) {
    const message = sanitizeAnalyticsAutomationError(error);
    try {
      await finishRun(client, runId, leaseOwner, "failed", "orchestration_failed", message);
    } catch {
      // Ownership may already have been reclaimed; do not overwrite a newer run.
    }

    return {
      success: false,
      status: "failed",
      run_id: runId,
      pages_processed: pagesProcessed,
      churches_attempted: churchesAttempted,
      churches_succeeded: churchesSucceeded,
      churches_failed: churchesFailed,
      last_cursor: cursor,
      error: message,
    };
  }
}
