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

function jsonResponse(status: number, body: AutomationResponse) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Automation backend is not configured.");
    }

    // Do not inherit or forward the request Authorization header. This RPC must
    // run with the function's service-role credentials, never a browser session.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("daily-automations started", { timestamp });

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
