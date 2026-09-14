import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadLiveUser } from "../_shared/provider-ingestion-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!authHeader || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // The browser may invoke this function after signup, but it may not select
    // the Customer.io customer ID or any contact fields.  Bind the request to
    // the verified session instead of trusting its JSON body.
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user: authUser },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !authUser?.id) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // This is deliberately immediately before the provider request.  A
    // deleted UUID has no public.users row and cannot recreate a Customer.io
    // profile; a replacement UUID with the same email is independently valid.
    const live = await loadLiveUser(
      admin,
      authUser.id,
      "id, email, first_name, user_name, created_at",
    );
    if (!live.allowed) {
      return new Response(
        live.reason === "account_lookup_failed"
          ? "Account status unavailable"
          : "Account not found",
        {
          status: live.reason === "account_lookup_failed" ? 503 : 404,
          headers: corsHeaders,
        },
      );
    }

    const email = live.user.email || authUser.email || "";
    if (!email) {
      return new Response("Account email unavailable", { status: 422, headers: corsHeaders });
    }

    const siteId = Deno.env.get("CUSTOMERIO_SITE_ID");
    const apiKey = Deno.env.get("CUSTOMERIO_TRACK_API_KEY");

    if (!siteId || !apiKey) {
      console.error("CUSTOMERIO_SITE_ID or CUSTOMERIO_TRACK_API_KEY not set");
      return new Response("Customer.io not configured", { status: 500, headers: corsHeaders });
    }

    const auth = btoa(`${siteId}:${apiKey}`);
    const trackBaseUrl = (
      Deno.env.get("CUSTOMERIO_TRACK_API_BASE_URL") || "https://track.customer.io"
    ).replace(/\/$/, "");
    const createdAt = live.user.created_at
      ? new Date(live.user.created_at)
      : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      return new Response("Account creation time unavailable", {
        status: 422,
        headers: corsHeaders,
      });
    }

    const response = await fetch(
      `${trackBaseUrl}/api/v1/customers/${encodeURIComponent(authUser.id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          email,
          first_name: live.user.first_name || null,
          username: live.user.user_name || null,
          created_at: Math.floor(createdAt.getTime() / 1000),
          plan: "free",
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Customer.io error:", text);
      return new Response("Customer.io failed", { status: 500, headers: corsHeaders });
    }

    return new Response("Success", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});
