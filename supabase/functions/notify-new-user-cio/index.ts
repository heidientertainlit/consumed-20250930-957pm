import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isUuid,
  loadLiveUser,
} from "../_shared/provider-ingestion-guard.ts";

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

    // The webhook envelope is only an immutable UUID hint.  Contact fields
    // come from the current users row below, never from the request payload.
    if (!isUuid(newUserId)) {
      return jsonResponse({ error: "Invalid new-user payload" }, 400);
    }

    const siteId = Deno.env.get("CUSTOMERIO_SITE_ID");
    const trackApiKey = Deno.env.get("CUSTOMERIO_TRACK_API_KEY");
    const notifyEmail = Deno.env.get("NOTIFY_EMAIL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!siteId || !trackApiKey || !notifyEmail || !supabaseUrl || !serviceRoleKey) {
      // Do not reveal which provider credential is absent.
      return jsonResponse({ error: "Customer.io is not configured" }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const currentLiveUser = () => loadLiveUser(
      admin,
      newUserId,
      "id, email, created_at",
    );
    const initialLiveUser = await currentLiveUser();
    if (!initialLiveUser.allowed || !initialLiveUser.user.email) {
      return jsonResponse(
        { error: "Account is not eligible for provider ingestion" },
        !initialLiveUser.allowed &&
          initialLiveUser.reason === "account_lookup_failed"
          ? 503
          : 404,
      );
    }

    const basicAuth = btoa(`${siteId}:${trackApiKey}`);
    const adminCustomerId = `admin:${notifyEmail.toLowerCase()}`;

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

    // Re-check the exact row immediately before every provider request that
    // contains the new user's identity.  A deletion removes this row; a
    // replacement UUID is checked independently and is not selected by email.
    const beforeAdminEvent = await currentLiveUser();
    if (!beforeAdminEvent.allowed || !beforeAdminEvent.user.email) {
      return jsonResponse(
        { error: "Account is not eligible for provider ingestion" },
        !beforeAdminEvent.allowed &&
          beforeAdminEvent.reason === "account_lookup_failed"
          ? 503
          : 404,
      );
    }
    const adminEventCreatedAt = beforeAdminEvent.user.created_at
      ? new Date(beforeAdminEvent.user.created_at)
      : new Date();
    if (Number.isNaN(adminEventCreatedAt.getTime())) {
      return jsonResponse({ error: "Account creation time unavailable" }, 422);
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
            new_user_email: beforeAdminEvent.user.email,
            signed_up_at: adminEventCreatedAt.toISOString(),
          },
        }),
      },
    );

    if (!adminEventRes.ok) {
      await adminEventRes.text().catch(() => undefined);
      return jsonResponse({ error: "Customer.io request failed" }, 502);
    }

    const beforeUserIdentify = await currentLiveUser();
    if (!beforeUserIdentify.allowed || !beforeUserIdentify.user.email) {
      return jsonResponse(
        { error: "Account is not eligible for provider ingestion" },
        !beforeUserIdentify.allowed &&
          beforeUserIdentify.reason === "account_lookup_failed"
          ? 503
          : 404,
      );
    }
    const userIdentifyCreatedAt = beforeUserIdentify.user.created_at
      ? new Date(beforeUserIdentify.user.created_at)
      : new Date();
    if (Number.isNaN(userIdentifyCreatedAt.getTime())) {
      return jsonResponse({ error: "Account creation time unavailable" }, 422);
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
          email: beforeUserIdentify.user.email,
          created_at: Math.floor(userIdentifyCreatedAt.getTime() / 1000),
          signup_source: "supabase_auth",
        }),
      },
    );

    if (!userIdentifyRes.ok) {
      await userIdentifyRes.text().catch(() => undefined);
      return jsonResponse({ error: "Customer.io request failed" }, 502);
    }

    const beforeUserEvent = await currentLiveUser();
    if (!beforeUserEvent.allowed || !beforeUserEvent.user.email) {
      return jsonResponse(
        { error: "Account is not eligible for provider ingestion" },
        !beforeUserEvent.allowed &&
          beforeUserEvent.reason === "account_lookup_failed"
          ? 503
          : 404,
      );
    }
    const userEventCreatedAt = beforeUserEvent.user.created_at
      ? new Date(beforeUserEvent.user.created_at)
      : new Date();
    if (Number.isNaN(userEventCreatedAt.getTime())) {
      return jsonResponse({ error: "Account creation time unavailable" }, 422);
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
            email: beforeUserEvent.user.email,
            signed_up_at: userEventCreatedAt.toISOString(),
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