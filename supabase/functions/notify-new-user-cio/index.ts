const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-consumed-new-user-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const WEBHOOK_SECRET_ENV = "NEW_USER_CIO_WEBHOOK_SECRET";
const WEBHOOK_HEADER = "x-consumed-new-user-secret";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 3 &&
    value.length <= 320 &&
    value.includes("@");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // This is a server-to-server database webhook.  Do not parse the payload or
  // touch Customer.io until the dedicated credential has been verified.
  const expectedSecret = Deno.env.get(WEBHOOK_SECRET_ENV) ?? "";
  const suppliedSecret = req.headers.get(WEBHOOK_HEADER) ?? "";
  if (!expectedSecret) {
    return jsonResponse({ error: "Webhook authentication is not configured" }, 503);
  }
  if (!suppliedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    // Keep compatibility with Supabase Database Webhooks (`record`), the
    // legacy `new` envelope, and direct producer payloads.
    const newUser = body?.record ?? body?.new ?? body;
    const newUserId = newUser?.id;
    const newUserEmail = newUser?.email;
    const createdAtValue = newUser?.created_at;

    if (!isUuid(newUserId) || !isEmail(newUserEmail)) {
      return jsonResponse({ error: "Invalid new-user payload" }, 400);
    }

    const createdAt = createdAtValue
      ? new Date(createdAtValue)
      : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      return jsonResponse({ error: "Invalid new-user payload" }, 400);
    }

    const siteId = Deno.env.get("CUSTOMERIO_SITE_ID");
    const trackApiKey = Deno.env.get("CUSTOMERIO_TRACK_API_KEY");
    const notifyEmail = Deno.env.get("NOTIFY_EMAIL");

    if (!siteId || !trackApiKey || !notifyEmail) {
      // Do not reveal which provider credential is absent.
      return jsonResponse({ error: "Customer.io is not configured" }, 503);
    }

    const basicAuth = btoa(`${siteId}:${trackApiKey}`);
    const adminCustomerId = `admin:${notifyEmail.toLowerCase()}`;
    const createdAtIso = createdAt.toISOString();
    const createdAtUnix = Math.floor(createdAt.getTime() / 1000);

    // Identify the internal recipient before sending the admin event.
    const adminIdentifyRes = await fetch(
      `https://track.customer.io/api/v1/customers/${encodeURIComponent(adminCustomerId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: notifyEmail,
          role: "admin_signup_notifier",
        }),
      },
    );

    if (!adminIdentifyRes.ok) {
      await adminIdentifyRes.text().catch(() => undefined);
      return jsonResponse({ error: "Customer.io request failed" }, 502);
    }

    const adminEventRes = await fetch(
      `https://track.customer.io/api/v1/customers/${encodeURIComponent(adminCustomerId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "supabase_new_user_joined",
          data: {
            new_user_id: newUserId,
            new_user_email: newUserEmail,
            signed_up_at: createdAtIso,
          },
        }),
      },
    );

    if (!adminEventRes.ok) {
      await adminEventRes.text().catch(() => undefined);
      return jsonResponse({ error: "Customer.io request failed" }, 502);
    }

    const userIdentifyRes = await fetch(
      `https://track.customer.io/api/v1/customers/${encodeURIComponent(newUserId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUserEmail,
          created_at: createdAtUnix,
          signup_source: "supabase_auth",
        }),
      },
    );

    if (!userIdentifyRes.ok) {
      await userIdentifyRes.text().catch(() => undefined);
      return jsonResponse({ error: "Customer.io request failed" }, 502);
    }

    const userEventRes = await fetch(
      `https://track.customer.io/api/v1/customers/${encodeURIComponent(newUserId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "signed_up",
          data: {
            email: newUserEmail,
            signed_up_at: createdAtIso,
          },
        }),
      },
    );

    if (!userEventRes.ok) {
      await userEventRes.text().catch(() => undefined);
      return jsonResponse({ error: "Customer.io request failed" }, 502);
    }

    return jsonResponse({
      ok: true,
      admin_notified: true,
      user_identified: true,
      user_signed_up_event_sent: true,
    });
  } catch {
    // Never echo provider responses, payloads, or credentials.
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});