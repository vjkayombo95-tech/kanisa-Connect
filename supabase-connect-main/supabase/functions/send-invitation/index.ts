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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  try {
    const { email, token } = await req.json() as SendInvitationPayload;

    if (!email?.trim() || !token?.trim()) {
      return new Response(JSON.stringify({ error: "email and token are required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!resendApiKey || !resendFromEmail) {
      throw new Error("Missing email provider configuration");
    }

    const origin = getOrigin(req);
    const inviteLink = `${origin}/invite/${token}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [email.trim().toLowerCase()],
        subject: "You are invited to join a church",
        text: `You have been invited to join a church platform.\nClick the link below to accept the invitation:\n\n${inviteLink}`,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(errorText || "Failed to send invitation email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invitation";

    console.error("send-invitation error:", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
});
