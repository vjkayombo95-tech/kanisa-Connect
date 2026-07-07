import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tenant, PlatformStatus } from "@/lib/tenant";
import { evaluatePlatformStatus } from "@/lib/tenant";

export type HealthCheckName =
  | "supabase"
  | "authentication"
  | "storage"
  | "bible"
  | "daily_readings"
  | "calendar"
  | "notifications"
  | "tenant_configuration";

export type HealthCheckResult = {
  name: HealthCheckName;
  ok: boolean;
  checkedAt: string;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
};

export type HealthCheckRunner = () => Promise<HealthCheckResult>;

function nowIso() {
  return new Date().toISOString();
}

async function timed(name: HealthCheckName, check: () => Promise<Omit<HealthCheckResult, "name" | "checkedAt" | "latencyMs">>) {
  const startedAt = performance.now();

  try {
    const result = await check();
    return {
      name,
      checkedAt: nowIso(),
      latencyMs: Math.round(performance.now() - startedAt),
      ...result,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      checkedAt: nowIso(),
      latencyMs: Math.round(performance.now() - startedAt),
      message: error instanceof Error ? error.message : "Health check failed.",
    };
  }
}

export function createSupabaseConnectivityCheck(supabase: SupabaseClient): HealthCheckRunner {
  return () =>
    timed("supabase", async () => {
      const { error } = await supabase.from("churches").select("id", { count: "exact", head: true });
      return {
        ok: !error,
        message: error?.message,
      };
    });
}

export function createAuthenticationCheck(supabase: SupabaseClient): HealthCheckRunner {
  return () =>
    timed("authentication", async () => {
      const { data, error } = await supabase.auth.getSession();
      return {
        ok: !error,
        message: error?.message ?? (data.session ? "Authenticated session available." : "No active session."),
        details: { hasSession: !!data.session },
      };
    });
}

export function createStorageCheck(supabase: SupabaseClient, bucket = "church-assets"): HealthCheckRunner {
  return () =>
    timed("storage", async () => {
      const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
      return {
        ok: !error,
        message: error?.message,
        details: { bucket },
      };
    });
}

export function createTableAvailabilityCheck(
  name: Extract<HealthCheckName, "bible" | "daily_readings" | "calendar" | "notifications">,
  supabase: SupabaseClient,
  table: string,
): HealthCheckRunner {
  return () =>
    timed(name, async () => {
      const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
      return {
        ok: !error,
        message: error?.message,
        details: { table },
      };
    });
}

export function createTenantConfigurationCheck(tenant: Tenant, status?: PlatformStatus): HealthCheckRunner {
  return async () => {
    const evaluatedStatus = status ?? evaluatePlatformStatus(tenant);

    return {
      name: "tenant_configuration",
      ok: evaluatedStatus.readyForPilot,
      checkedAt: nowIso(),
      message: evaluatedStatus.readyForPilot
        ? "Tenant is ready for pilot use."
        : "Tenant configuration is incomplete.",
      details: evaluatedStatus,
    };
  };
}

export async function runHealthChecks(checks: HealthCheckRunner[]) {
  return Promise.all(checks.map((check) => check()));
}
