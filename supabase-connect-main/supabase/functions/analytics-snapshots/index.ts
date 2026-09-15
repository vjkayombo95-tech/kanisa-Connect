import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleAnalyticsSnapshotsRequest } from "./handler.ts";

Deno.serve(async (request) => {
  return handleAnalyticsSnapshotsRequest(request, {
    createClient,
    env: Deno.env,
    console,
  });
});

// Intended schedule after deployment approval: daily at 02:00 local operational
// time. Keep JWT verification enabled and configure a trusted scheduler to send
// one POST to /functions/v1/analytics-snapshots. Do not place the service-role
// key in browser code, source-controlled scheduler URLs, or client env vars.
