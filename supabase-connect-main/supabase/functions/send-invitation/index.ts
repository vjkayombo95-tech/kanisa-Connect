import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendInvitationPayload = {
  email: string;
  token: string;
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

const getOrigin = (req: Request) => {
  const originHeader = req.headers.get("origin");
  if (originHeader) return originHeader.replace(/\/$/, "");

  const refererHeader = req.headers.get("referer");
  if (refererHeader) {
    const refererUrl = new URL(refererHeader);
    return refererUrl.origin;
  }

  const appUrl = Deno.env.get("APP_URL");
  if (appUrl) return appUrl.replace(/\/$/, "");

  throw new Error("Missing origin");
};

async function authorizeInvitationSender(req: Request, token: string, email: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Invitation authorization is not configured.");
  }

  if (!authorization.trim()) {
    return { authorized: false, status: 403, error: "Forbidden" };
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

  const { data: authData, error: authError } = await callerSupabase.auth.getUser();
  if (authError || !authData.user) {
    return { authorized: false, status: 403, error: "Forbidden" };
  }

  const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: invitation, error: invitationError } = await serviceSupabase
    .from("invitations")
    .select("church_id, email")
    .eq("token", token)
    .maybeSingle();

  if (invitationError) {
    throw new Error(invitationError.message);
  }

  if (!invitation?.church_id) {
    return { authorized: false, status: 403, error: "Forbidden" };
  }

  if (invitation.email?.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { authorized: false, status: 403, error: "Forbidden" };
  }

  const { data: isSuperAdmin, error: superAdminError } = await callerSupabase.rpc("is_super_admin");
  if (superAdminError) {
    throw new Error(superAdminError.message);
  }

  if (isSuperAdmin === true) {
    return { authorized: true, status: 200, error: null };
  }

  const { data: canManageChurch, error: canManageError } = await callerSupabase.rpc(
    "has_church_feature_permission",
    {
      _user_id: authData.user.id,
      _church_id: invitation.church_id,
      _feature_key: "roles",
      _action: "manage",
    },
  );

  if (canManageError) {
    throw new Error(canManageError.message);
  }

  return {
    authorized: canManageChurch === true,
    status: canManageChurch === true ? 200 : 403,
    error: canManageChurch === true ? null : "Forbidden",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(400, { error: "Method not allowed" });
  }

  try {
    const { email, token } = await req.json() as SendInvitationPayload;

    if (!email?.trim() || !token?.trim()) {
      return jsonResponse(400, { error: "email and token are required" });
    }

    const authorization = await authorizeInvitationSender(req, token, email);
    if (!authorization.authorized) {
      return jsonResponse(authorization.status, { error: authorization.error });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!resendApiKey || !resendFromEmail) {
      return jsonResponse(500, {
        error: "Invitation email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in Supabase function secrets.",
      });
    }

    const origin = getOrigin(req);
    const { data: invitationDetails } = await serviceSupabase
      .from("invitations")
      .select("churches(name, code, church_code, short_code)")
      .eq("token", token)
      .maybeSingle();
    const church = Array.isArray(invitationDetails?.churches)
      ? invitationDetails?.churches[0]
      : invitationDetails?.churches;
    const visibleChurchCode = church?.church_code || church?.code || "";
    const visibleJoinCode = church?.short_code || "";
    const inviteLink = `${origin}/invite/${token}${visibleJoinCode || visibleChurchCode ? `?churchCode=${encodeURIComponent(visibleJoinCode || visibleChurchCode)}` : ""}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [email.trim().toLowerCase()],
        subject: `You are invited to join ${church?.name || "a church"}`,
        text: `You have been invited to join ${church?.name || "a church"} on Kanisa Connect.\n${visibleChurchCode ? `Church Code: ${visibleChurchCode}\n` : ""}${visibleJoinCode ? `Join Code: ${visibleJoinCode}\n` : ""}\nClick the link below to accept the invitation:\n\n${inviteLink}`,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      let providerMessage = errorText || "The provider rejected this email.";

      try {
        const providerError = JSON.parse(errorText) as { message?: string; error?: { message?: string } };
        providerMessage = providerError.message || providerError.error?.message || providerMessage;
      } catch {
        // Leave the provider response text intact when it is not JSON.
      }

      return jsonResponse(502, {
        error: `Email provider rejected invitation: ${providerMessage}`,
      });
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invitation";

    console.error("send-invitation error:", message);

    return jsonResponse(400, { error: message });
  }
});
