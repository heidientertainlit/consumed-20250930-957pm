import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authorization required" }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);

  const db = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // getUser validates the bearer JWT with Supabase; do not trust client claims
  // or user metadata for the administrator decision below.
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const { data: admin, error: adminError } = await db
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (adminError) return json({ error: "Could not verify administrator authorization" }, 500);
  if (admin?.is_admin !== true) return json({ error: "Administrator authorization required" }, 403);

  let body: { userIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "A JSON request body is required" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Request body must be an object" }, 400);
  }

  const requestedIds = body.userIds;
  if (requestedIds !== undefined && (!Array.isArray(requestedIds)
    || requestedIds.some((id) => typeof id !== "string" || !uuid.test(id)))) {
    return json({ error: "userIds must be an array of valid UUIDs" }, 400);
  }
  if (Array.isArray(requestedIds) && new Set(requestedIds).size !== requestedIds.length) {
    return json({ error: "userIds must not contain duplicates" }, 400);
  }

  try {
    let query = db.from("dna_profiles").select("user_id, label, tagline, flavor_notes, favorite_genres");
    if (Array.isArray(requestedIds)) {
      if (requestedIds.length === 0) return json({ profiles: [] });
      query = query.in("user_id", requestedIds);
    }
    const { data: profiles, error } = await query;
    if (error) throw error;
    return json({ profiles: profiles || [] });
  } catch (error) {
    console.error("[admin-dna-export]", error);
    return json({ error: "DNA export could not be loaded" }, 500);
  }
});