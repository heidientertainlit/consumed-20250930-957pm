import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeServiceRole } from "../_shared/authorization.ts";

/** Separate, service-only worker. No production invocation or cron activation. */
serve(async req => {
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const auth = authorizeServiceRole(req);
  if (!auth.authorized) return reply({ error: auth.error }, auth.status);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: runs, error } = await db.from("persona_conversation_runs").select("id").eq("status", "scheduled")
      .lte("start_at", new Date().toISOString()).or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`).order("start_at").limit(20);
    if (error) throw new Error("Could not read due conversations");
    const results = [];
    for (const run of runs || []) {
      const { data, error } = await db.rpc("deliver_persona_conversation", { p_run: run.id });
      results.push({ id: run.id, ...(error ? { status: "failed", error: "Delivery transaction unavailable" } : data) });
    }
    return reply({ results });
  } catch { return reply({ error: "Conversation worker failed; no untransactional writes attempted" }, 500); }
});
