import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = {
  "Content-Type": "application/json",
};

type AutomationResponse = {
  success: boolean;
  timestamp: string;
  execution_time_ms: number;
  error: string | null;
};

type AuthorizationResult = {
  authorized: boolean;
  scheduler: boolean;
};

function jsonResponse(status: number, body: AutomationResponse) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

async function authorizeRequest(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string,
): Promise<AuthorizationResult> {
  const authorization = request.headers.get("Authorization") ?? "";
  const bearerToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!bearerToken) {
    return { authorized: false, scheduler: false };
  }

  if (bearerToken === serviceRoleKey) {
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
    console.warn("daily-automations authorization check failed", {
      error: error.message,
    });
    return { authorized: false, scheduler: false };
  }

  return { authorized: data === true, scheduler: false };
}

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  if (request.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      timestamp,
      execution_time_ms: Date.now() - startedAt,
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Automation backend is not configured.");
    }

    const authorization = await authorizeRequest(request, supabaseUrl, anonKey, serviceRoleKey);

    if (!authorization.authorized) {
      return jsonResponse(403, {
        success: false,
        timestamp,
        execution_time_ms: Date.now() - startedAt,
        error: "Forbidden. Super admin access is required.",
      });
    }

    // Do not inherit or forward the request Authorization header. This RPC must
    // run with the function's service-role credentials, never a browser session.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("daily-automations started", {
      timestamp,
      invoked_by: authorization.scheduler ? "scheduler" : "super_admin",
    });

    const { error } = await supabase.rpc("run_daily_automations");

    if (error) {
      throw new Error(error.message);
    }

    const executionTime = Date.now() - startedAt;
    console.log("daily-automations completed", {
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,
    });

    return jsonResponse(200, {
      success: true,
      timestamp,
      execution_time_ms: executionTime,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily automation execution failed.";
    const executionTime = Date.now() - startedAt;

    console.error("daily-automations failed", {
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,
      error: message,
    });

    return jsonResponse(500, {
      success: false,
      timestamp,
      execution_time_ms: executionTime,
      error: message,
    });
  }
});

// Scheduling (after deployment): configure a trusted scheduler to send one POST
// each day to /functions/v1/daily-automations. Keep JWT verification enabled for
// the function, store the scheduler credential as a secret, and never place the
// SUPABASE_SERVICE_ROLE_KEY in browser code or scheduler URLs.
