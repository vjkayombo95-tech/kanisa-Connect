import {
  orchestrateAnalyticsSnapshots,
  sanitizeAnalyticsAutomationError,
  type AnalyticsSchedulerClient,
} from "./orchestrator.ts";

const jsonHeaders = {
  "Content-Type": "application/json",
};

type SupabaseFactory = (url: string, key: string, options?: Record<string, unknown>) => AnalyticsSchedulerClient;

type EnvReader = {
  get(name: string): string | undefined;
};

type AnalyticsAutomationResponse = {
  success: boolean;
  timestamp: string;
  execution_time_ms: number;
  status: "completed" | "failed" | "skipped";
  run_id: string | null;
  pages_processed: number;
  churches_attempted: number;
  churches_succeeded: number;
  churches_failed: number;
  error: string | null;
};

type AuthorizationResult = {
  authorized: boolean;
  scheduler: boolean;
};

export type AnalyticsSnapshotsHandlerDependencies = {
  createClient: SupabaseFactory;
  env: EnvReader;
  orchestrate?: typeof orchestrateAnalyticsSnapshots;
  console?: Pick<Console, "log" | "warn" | "error">;
  now?: () => number;
};

function jsonResponse(status: number, body: AnalyticsAutomationResponse) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

export async function authorizeAnalyticsSnapshotsRequest(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  schedulerSecret: string | undefined,
  createClient: SupabaseFactory,
  logger: Pick<Console, "warn"> = console,
): Promise<AuthorizationResult> {
  const authorization = request.headers.get("Authorization") ?? "";
  const bearerToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!authorization.match(/^Bearer\s+\S+$/i) || !bearerToken) {
    return { authorized: false, scheduler: false };
  }

  const schedulerSecretHeader = request.headers.get("X-Analytics-Scheduler-Secret") ?? "";
  if (isNonEmptyTimingSafeMatch(schedulerSecretHeader, schedulerSecret)) {
    return { authorized: true, scheduler: true };
  }

  const callerSupabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await callerSupabase.rpc("is_super_admin");

  if (error) {
    logger.warn("analytics-snapshots authorization check failed", {
      error: sanitizeAnalyticsAutomationError(error.message),
    });
    return { authorized: false, scheduler: false };
  }

  return { authorized: data === true, scheduler: false };
}

function isNonEmptyTimingSafeMatch(candidate: string, expected: string | undefined) {
  if (!candidate || !expected) return false;

  const encoder = new TextEncoder();
  const candidateBytes = encoder.encode(candidate);
  const expectedBytes = encoder.encode(expected);
  const maxLength = Math.max(candidateBytes.length, expectedBytes.length);
  let diff = candidateBytes.length ^ expectedBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (candidateBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }

  return diff === 0;
}

export async function handleAnalyticsSnapshotsRequest(
  request: Request,
  dependencies: AnalyticsSnapshotsHandlerDependencies,
) {
  const now = dependencies.now ?? Date.now;
  const logger = dependencies.console ?? console;
  const orchestrate = dependencies.orchestrate ?? orchestrateAnalyticsSnapshots;
  const startedAt = now();
  const timestamp = new Date().toISOString();

  if (request.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      timestamp,
      execution_time_ms: now() - startedAt,
      status: "failed",
      run_id: null,
      pages_processed: 0,
      churches_attempted: 0,
      churches_succeeded: 0,
      churches_failed: 0,
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    const supabaseUrl = dependencies.env.get("SUPABASE_URL");
    const anonKey = dependencies.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = dependencies.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const schedulerSecret = dependencies.env.get("ANALYTICS_SCHEDULER_SECRET");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Analytics automation backend is not configured.");
    }

    const authorization = await authorizeAnalyticsSnapshotsRequest(
      request,
      supabaseUrl,
      anonKey,
      schedulerSecret,
      dependencies.createClient,
      logger,
    );

    if (!authorization.authorized) {
      return jsonResponse(403, {
        success: false,
        timestamp,
        execution_time_ms: now() - startedAt,
        status: "failed",
        run_id: null,
        pages_processed: 0,
        churches_attempted: 0,
        churches_succeeded: 0,
        churches_failed: 0,
        error: "Forbidden. Super admin access is required.",
      });
    }

    const supabase = dependencies.createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    logger.log("analytics-snapshots started", {
      timestamp,
      invoked_by: authorization.scheduler ? "scheduler" : "super_admin",
    });

    const result = await orchestrate(supabase, {
      invocationSource: authorization.scheduler ? "scheduler" : "super_admin",
    });

    const executionTime = now() - startedAt;
    logger.log("analytics-snapshots completed", {
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,
      status: result.status,
      pages_processed: result.pages_processed,
      churches_attempted: result.churches_attempted,
      churches_succeeded: result.churches_succeeded,
      churches_failed: result.churches_failed,
    });

    return jsonResponse(result.success ? 200 : 500, {
      success: result.success,
      timestamp,
      execution_time_ms: executionTime,
      status: result.status,
      run_id: result.run_id,
      pages_processed: result.pages_processed,
      churches_attempted: result.churches_attempted,
      churches_succeeded: result.churches_succeeded,
      churches_failed: result.churches_failed,
      error: result.error,
    });
  } catch (error) {
    const message = sanitizeAnalyticsAutomationError(error);
    const executionTime = now() - startedAt;

    logger.error("analytics-snapshots failed", {
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,
      error: message,
    });

    return jsonResponse(500, {
      success: false,
      timestamp,
      execution_time_ms: executionTime,
      status: "failed",
      run_id: null,
      pages_processed: 0,
      churches_attempted: 0,
      churches_succeeded: 0,
      churches_failed: 0,
      error: message,
    });
  }
}
