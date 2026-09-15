import { describe, expect, it, vi } from "vitest";
import { handleAnalyticsSnapshotsRequest } from "../../supabase/functions/analytics-snapshots/handler";

type ClientCall = {
  key: string;
  options?: Record<string, unknown>;
};

const env = new Map([
  ["SUPABASE_URL", "https://example.supabase.co"],
  ["SUPABASE_ANON_KEY", "anon-key"],
  ["SUPABASE_SERVICE_ROLE_KEY", "service-role-secret"],
  ["ANALYTICS_SCHEDULER_SECRET", "scheduler-secret"],
]);

function envWithoutSchedulerSecret() {
  return new Map([
    ["SUPABASE_URL", "https://example.supabase.co"],
    ["SUPABASE_ANON_KEY", "anon-key"],
    ["SUPABASE_SERVICE_ROLE_KEY", "service-role-secret"],
  ]);
}

function request(method: string, authorization?: string, schedulerSecret?: string) {
  return new Request("https://example.functions.supabase.co/analytics-snapshots", {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(schedulerSecret !== undefined ? { "X-Analytics-Scheduler-Secret": schedulerSecret } : {}),
    },
  });
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function harness(options: {
  isSuperAdmin?: boolean;
  authError?: string;
  orchestrationSuccess?: boolean;
  orchestrationError?: string;
} = {}) {
  const clientCalls: ClientCall[] = [];
  const rpcCalls: Array<{ key: string; name: string }> = [];
  const logs: unknown[] = [];
  const warns: unknown[] = [];
  const errors: unknown[] = [];
  const createClient = vi.fn((_: string, key: string, clientOptions?: Record<string, unknown>): any => {
    clientCalls.push({ key, options: clientOptions });
    return {
      async rpc(name: string) {
        rpcCalls.push({ key, name });
        if (key === "anon-key" && name === "is_super_admin") {
          if (options.authError) return { data: null, error: { message: options.authError } };
          return { data: options.isSuperAdmin === true, error: null };
        }
        return { data: null, error: null };
      },
    };
  });
  const orchestrate = vi.fn(async () => {
    if (options.orchestrationError) {
      throw new Error(options.orchestrationError);
    }

    return {
      success: options.orchestrationSuccess ?? true,
      status: (options.orchestrationSuccess === false ? "failed" : "completed") as "failed" | "completed",
      run_id: "run-1",
      pages_processed: 1,
      churches_attempted: 2,
      churches_succeeded: 2,
      churches_failed: 0,
      last_cursor: "church-2",
      error: options.orchestrationSuccess === false ? "failed" : null,
    };
  });

  return {
    clientCalls,
    createClient,
    orchestrate,
    rpcCalls,
    logger: {
      log: (...args: unknown[]) => logs.push(args),
      warn: (...args: unknown[]) => warns.push(args),
      error: (...args: unknown[]) => errors.push(args),
    },
    logs,
    warns,
    errors,
  };
}

describe("Wave 17 analytics Edge authorization", () => {
  it("enforces POST-only including OPTIONS", async () => {
    const tools = harness();
    const getResponse = await handleAnalyticsSnapshotsRequest(request("GET"), {
      createClient: tools.createClient,
      env,
      orchestrate: tools.orchestrate,
      console: tools.logger,
    });
    const optionsResponse = await handleAnalyticsSnapshotsRequest(request("OPTIONS"), {
      createClient: tools.createClient,
      env,
      orchestrate: tools.orchestrate,
      console: tools.logger,
    });

    expect(getResponse.status).toBe(405);
    expect(optionsResponse.status).toBe(405);
    expect(tools.orchestrate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and malformed POST requests", async () => {
    for (const authorization of [undefined, "Basic abc", "Bearer "]) {
      const tools = harness();
      const response = await handleAnalyticsSnapshotsRequest(request("POST", authorization), {
        createClient: tools.createClient,
        env,
        orchestrate: tools.orchestrate,
        console: tools.logger,
      });

      expect(response.status).toBe(403);
      expect(await body(response)).toMatchObject({ success: false, error: "Forbidden. Super admin access is required." });
      expect(tools.orchestrate).not.toHaveBeenCalled();
    }
  });

  it("rejects authenticated ordinary members, staff, and cross-church admins without super-admin privilege", async () => {
    for (const token of ["member-token", "staff-token", "cross-church-admin-token"]) {
      const tools = harness({ isSuperAdmin: false });
      const response = await handleAnalyticsSnapshotsRequest(request("POST", `Bearer ${token}`), {
        createClient: tools.createClient,
        env,
        orchestrate: tools.orchestrate,
        console: tools.logger,
      });

      expect(response.status).toBe(403);
      expect(tools.rpcCalls).toEqual([{ key: "anon-key", name: "is_super_admin" }]);
      expect(tools.orchestrate).not.toHaveBeenCalled();
    }
  });

  it("accepts a super-admin user into the trusted orchestration path without forwarding caller auth", async () => {
    const tools = harness({ isSuperAdmin: true });
    const response = await handleAnalyticsSnapshotsRequest(request("POST", "Bearer super-admin-token"), {
      createClient: tools.createClient,
      env,
      orchestrate: tools.orchestrate,
      console: tools.logger,
    });

    expect(response.status).toBe(200);
    expect(tools.orchestrate).toHaveBeenCalledWith(expect.anything(), { invocationSource: "super_admin" });
    expect(tools.clientCalls[0]).toMatchObject({
      key: "anon-key",
      options: { global: { headers: { Authorization: "Bearer super-admin-token" } } },
    });
    expect(tools.clientCalls[1]).toMatchObject({ key: "service-role-secret" });
    expect(JSON.stringify(tools.clientCalls[1].options)).not.toContain("super-admin-token");
  });

  it("denies gateway-valid bearer tokens as scheduler without the scheduler secret", async () => {
    for (const authorization of ["Bearer service-role-secret", "Bearer different-service-role-token"]) {
      const tools = harness({ isSuperAdmin: false });
      const response = await handleAnalyticsSnapshotsRequest(request("POST", authorization), {
        createClient: tools.createClient,
        env,
        orchestrate: tools.orchestrate,
        console: tools.logger,
      });

      expect(response.status).toBe(403);
      expect(tools.orchestrate).not.toHaveBeenCalled();
      expect(tools.clientCalls).toHaveLength(1);
      expect(tools.clientCalls[0].key).toBe("anon-key");
    }
  });

  it("accepts a gateway-valid bearer plus scheduler secret as scheduler without caller auth forwarding", async () => {
    const tools = harness();
    const response = await handleAnalyticsSnapshotsRequest(
      request("POST", "Bearer gateway-valid-jwt", "scheduler-secret"),
      {
        createClient: tools.createClient,
        env,
        orchestrate: tools.orchestrate,
        console: tools.logger,
      },
    );

    expect(response.status).toBe(200);
    expect(tools.createClient).toHaveBeenCalledTimes(1);
    expect(tools.clientCalls[0]).toMatchObject({ key: "service-role-secret" });
    expect(JSON.stringify(tools.clientCalls[0].options)).not.toContain("Authorization");
    expect(JSON.stringify(tools.clientCalls[0].options)).not.toContain("scheduler-secret");
    expect(tools.orchestrate).toHaveBeenCalledWith(expect.anything(), { invocationSource: "scheduler" });
  });

  it("denies incorrect, empty, or missing runtime scheduler secrets and preserves super-admin fallback", async () => {
    for (const schedulerSecret of ["wrong-secret", ""]) {
      const tools = harness({ isSuperAdmin: false });
      const response = await handleAnalyticsSnapshotsRequest(request("POST", "Bearer gateway-valid-jwt", schedulerSecret), {
        createClient: tools.createClient,
        env,
        orchestrate: tools.orchestrate,
        console: tools.logger,
      });

      expect(response.status).toBe(403);
      expect(tools.orchestrate).not.toHaveBeenCalled();
    }

    const missingRuntime = harness({ isSuperAdmin: false });
    const missingRuntimeResponse = await handleAnalyticsSnapshotsRequest(
      request("POST", "Bearer gateway-valid-jwt", "scheduler-secret"),
      {
        createClient: missingRuntime.createClient,
        env: envWithoutSchedulerSecret(),
        orchestrate: missingRuntime.orchestrate,
        console: missingRuntime.logger,
      },
    );

    expect(missingRuntimeResponse.status).toBe(403);
    expect(missingRuntime.orchestrate).not.toHaveBeenCalled();

    const superAdmin = harness({ isSuperAdmin: true });
    const superAdminResponse = await handleAnalyticsSnapshotsRequest(request("POST", "Bearer super-admin-token"), {
      createClient: superAdmin.createClient,
      env,
      orchestrate: superAdmin.orchestrate,
      console: superAdmin.logger,
    });

    expect(superAdminResponse.status).toBe(200);
    expect(superAdmin.orchestrate).toHaveBeenCalledWith(expect.anything(), { invocationSource: "super_admin" });
  });

  it("does not return or log the service-role secret on failures", async () => {
    const tools = harness({ orchestrationError: "SUPABASE_SERVICE_ROLE_KEY=service-role-secret" });
    const response = await handleAnalyticsSnapshotsRequest(
      request("POST", "Bearer gateway-valid-jwt", "scheduler-secret"),
      {
        createClient: tools.createClient,
        env,
        orchestrate: tools.orchestrate,
        console: tools.logger,
      },
    );
    const payload = await body(response);

    expect(response.status).toBe(500);
    expect(JSON.stringify(payload)).not.toContain("service-role-secret");
    expect(JSON.stringify(payload)).not.toContain("scheduler-secret");
    expect(JSON.stringify(payload)).not.toContain("gateway-valid-jwt");
    expect(JSON.stringify(tools.errors)).not.toContain("service-role-secret");
    expect(JSON.stringify(tools.errors)).not.toContain("scheduler-secret");
    expect(JSON.stringify(tools.errors)).not.toContain("gateway-valid-jwt");
    expect(payload.error).toBe("SUPABASE_SERVICE_ROLE_KEY=[redacted]");
  });

  it("does not log the service-role secret from authorization check failures", async () => {
    const tools = harness({ authError: "service_role_key=service-role-secret" });
    const response = await handleAnalyticsSnapshotsRequest(request("POST", "Bearer user-token"), {
      createClient: tools.createClient,
      env,
      orchestrate: tools.orchestrate,
      console: tools.logger,
    });

    expect(response.status).toBe(403);
    expect(JSON.stringify(tools.warns)).not.toContain("service-role-secret");
    expect(JSON.stringify(tools.warns)).toContain("service_role_key=[redacted]");
  });
});
