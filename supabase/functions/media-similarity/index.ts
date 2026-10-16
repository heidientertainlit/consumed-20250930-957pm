import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { similarityIdentity } from "../../../shared/media-similarity.ts";
import { createMediaSimilarity } from "../_shared/media-similarity-engine.ts";

const headers = { "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return json({ error: "Unauthorized" }, 401);
    const { data: account, error: accountError } = await db.from("users").select("id,is_persona").eq("id", user.id).maybeSingle();
    if (accountError) throw new Error("Account validation failed");
    if (!account || account.is_persona) return json({ error: "Human account required" }, 403);
    if (Number(req.headers.get("Content-Length")) > 2048) return json({ error: "Request too large" }, 413);
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: "Request too large" }, 413);
    let identity;
    try { identity = similarityIdentity(JSON.parse(raw)); }
    catch { return json({ error: "Invalid media identity" }, 400); }
    const store = async (action: string, payload: Record<string, any> = {}) => {
      const { data, error } = await db.rpc("media_similarity_store", { p_action: action, p_payload: payload });
      if (error) throw new Error(`Similarity storage ${action} failed`);
      return data;
    };
    const service = createMediaSimilarity(store, Deno.env.get, work => EdgeRuntime.waitUntil(work));
    return json(await service.load(identity, user.id));
  } catch (e) {
    console.error("Media similarity request failed", e instanceof Error ? e.message : "unknown failure");
    return json({ error: "Similar recommendations unavailable" }, 503);
  }
});
