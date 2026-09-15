import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeAdminOrService } from "../_shared/authorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// These are opaque account identifiers only. Deliberately do not join profiles
// or users: admins can investigate through their existing protected tooling
// without this alert endpoint becoming an identity directory.
const alertFields = "id, created_at, acknowledged_at, user_blocks!inner(blocker_id, blocked_id)";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = await authorizeAdminOrService(req);
  if (!authorization.authorized) {
    return json({ error: authorization.error }, authorization.status);
  }

  let body: { action?: unknown; state?: unknown; alert_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "A JSON request body is required" }, 400);
  }

  const action = body.action;
  if (action !== "list" && action !== "acknowledge") {
    return json({ error: "action must be list or acknowledge" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  if (action === "list") {
    const state = body.state ?? "open";
    if (state !== "open" && state !== "acknowledged" && state !== "all") {
      return json({ error: "state must be open, acknowledged, or all" }, 400);
    }

    let query = admin
      .from("admin_block_alerts")
      .select(alertFields)
      .order("created_at", { ascending: false })
      .limit(100);

    if (state === "open") query = query.is("acknowledged_at", null);
    if (state === "acknowledged") query = query.not("acknowledged_at", "is", null);

    const { data, error } = await query;
    if (error) {
      console.error("Unable to list private block alerts:", error);
      return json({ error: "Unable to load block alerts" }, 500);
    }

    return json({ alerts: data ?? [] });
  }

  const alertId = typeof body.alert_id === "string" ? body.alert_id : "";
  if (!uuid.test(alertId)) return json({ error: "alert_id must be a valid UUID" }, 400);

  // The null predicate makes acknowledgement single-writer and idempotent.
  // No acknowledging-admin identity is included in the response.
  const { data: acknowledged, error: acknowledgementError } = await admin
    .from("admin_block_alerts")
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: authorization.userId ?? null,
    })
    .eq("id", alertId)
    .is("acknowledged_at", null)
    .select(alertFields)
    .maybeSingle();

  if (acknowledgementError) {
    console.error("Unable to acknowledge private block alert:", acknowledgementError);
    return json({ error: "Unable to acknowledge block alert" }, 500);
  }
  if (acknowledged) return json({ success: true, alert: acknowledged });

  // A concurrent acknowledgement is a successful, idempotent outcome.  Check
  // existence without returning the row or any account identifier.
  const { data: existing, error: existingError } = await admin
    .from("admin_block_alerts")
    .select("id")
    .eq("id", alertId)
    .maybeSingle();

  if (existingError) {
    console.error("Unable to verify private block alert:", existingError);
    return json({ error: "Unable to acknowledge block alert" }, 500);
  }
  if (!existing) return json({ error: "Block alert not found" }, 404);

  return json({ success: true, already_acknowledged: true });
});