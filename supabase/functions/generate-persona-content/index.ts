import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeAdminOrService } from "../_shared/authorization.ts";
import { DEFAULT_MODE_WEIGHTS, deriveSocialVoice, mediaKey, validateModeWeights, validateVoice, type Persona, type RecentPost, type MediaCandidate } from "../_shared/persona-generation.ts";
import { buildPersonaCandidates, createPersonaChat, fetchTrendingCandidates, resolveMediaCandidate } from "../_shared/persona-media-candidates.ts";
import { generatePersonaBatch } from "../_shared/persona-generation-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SETTINGS_KEY = "persona_generation_mode_weights";
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "POST required" }, 405);
  try {
    // Generation, debug previews and configuration are admin-only, not merely hidden in the UI.
    const authorization = await authorizeAdminOrService(req);
    if (!authorization.authorized) return response({ error: authorization.error }, authorization.status);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const body = await req.json();
    const action = body.action || "generate";
    if (action === "save-settings") {
      const weights = validateModeWeights(body.weights);
      const { error } = await db.from("app_settings").upsert({ key: SETTINGS_KEY, value: JSON.stringify(weights) }, { onConflict: "key" });
      if (error) throw new Error("Could not save mode weights");
      return response({ success: true, weights });
    }
    if (action === "save-voice") {
      if (typeof body.personaId !== "string") return response({ error: "personaId required" }, 400);
      const voice = validateVoice(body.voice);
      const { data: persona, error } = await db.from("users").select("persona_config").eq("id", body.personaId).eq("is_persona", true).single();
      if (error || !persona) return response({ error: "Persona not found" }, 404);
      const { error: saveError } = await db.from("users").update({ persona_config: { ...persona.persona_config, social_voice: voice } }).eq("id", body.personaId).eq("is_persona", true);
      if (saveError) throw new Error("Could not save persona voice");
      return response({ success: true, voice });
    }
    if (action !== "settings" && action !== "generate" && action !== "dry-run") return response({ error: "Unknown action" }, 400);
    const { data: setting, error: settingError } = await db.from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (settingError) throw new Error("Could not load generation settings");
    const weights = setting ? validateModeWeights(typeof setting.value === "string" ? JSON.parse(setting.value) : setting.value) : { ...DEFAULT_MODE_WEIGHTS };
    if (action === "settings") return response({ weights, capabilities: { dryRun: true, generationVersion: 1 } });

    // Preview deliberately uses different field names. An older deployed handler sees
    // no personaIds and rejects it, rather than ignoring dryRun and creating drafts.
    const request = action === "dry-run"
      ? { personaIds: body.previewPersonaIds, postsPerPersona: body.previewPostsPerPersona, useTrending: body.useTrending, dryRun: true }
      : body;
    const { personaIds, postsPerPersona = 2, useTrending = false, dryRun = false } = request;
    if (!Array.isArray(personaIds) || !personaIds.length || personaIds.length > 50 || personaIds.some((id: unknown) => typeof id !== "string")) return response({ error: "Select 1–50 valid personas" }, 400);
    if (!Number.isInteger(postsPerPersona) || postsPerPersona < 1 || postsPerPersona > 5) return response({ error: "postsPerPersona must be 1–5" }, 400);
    if (typeof dryRun !== "boolean" || typeof useTrending !== "boolean") return response({ error: "dryRun and useTrending must be booleans" }, 400);
    const { data: rows, error: personaError } = await db.from("users").select("id,user_name,display_name,persona_config").in("id", [...new Set(personaIds)]).eq("is_persona", true);
    if (personaError || !rows?.length) return response({ error: "No valid personas found" }, 400);
    const personas = rows as Persona[];
    for (const p of personas) {
      if (!p.persona_config) return response({ error: `${p.display_name} has no persona configuration` }, 400);
      deriveSocialVoice(p.persona_config); // Validate stored overrides before making any model requests.
    }
    const { data: allPersonas, error: allPersonaError } = await db.from("users").select("id").eq("is_persona", true).limit(200);
    if (allPersonaError) throw new Error("Could not load persona history owners");
    const ids = allPersonas?.map(p => p.id) || [];
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    // Pending drafts/schedules are checked regardless of age; only publication history is time-bounded.
    const historyResults = await Promise.all([
      db.from("persona_post_drafts").select("persona_user_id,media_title,media_type,content,created_at").in("persona_user_id", ids).eq("status", "draft").order("created_at", { ascending: false }).limit(500),
      db.from("scheduled_persona_posts").select("persona_user_id,media_title,media_type,content,created_at").in("persona_user_id", ids).eq("posted", false).order("created_at", { ascending: false }).limit(500),
      db.from("social_posts").select("user_id,media_title,media_type,content,created_at").in("user_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    ]);
    if (historyResults.some(r => r.error)) throw new Error("Could not load recent media history; generation stopped rather than ignoring repetition checks");
    const recent: RecentPost[] = [];
    const seen = new Set<string>();
    for (const item of historyResults.flatMap(r => r.data || []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
      if (!item.media_title || !item.media_type) continue;
      const entry = { personaId: item.persona_user_id || item.user_id, title: item.media_title, type: item.media_type.toLowerCase(), content: item.content || "", createdAt: item.created_at };
      const key = `${entry.personaId}:${mediaKey(entry)}`;
      if (!seen.has(key)) { recent.push(entry); seen.add(key); }
    }
    const { data: rejections, error: rejectionError } = await db.from("persona_post_drafts").select("persona_user_id,rejection_reason").in("persona_user_id", personas.map(p => p.id)).eq("status", "rejected").not("rejection_reason", "is", null).order("rejected_at", { ascending: false }).limit(100);
    if (rejectionError) throw new Error("Could not load existing rejection feedback");
    for (const p of personas) (p.persona_config as any).generation_feedback = (rejections || []).filter(r => r.persona_user_id === p.id).slice(0, 5).map(r => r.rejection_reason);
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return response({ error: "Writing provider is not configured" }, 503);
    const chat = createPersonaChat(key);
    const keys = { tmdb: Deno.env.get("TMDB_API_KEY"), books: Deno.env.get("GOOGLE_BOOKS_API_KEY"), rawg: Deno.env.get("RAWG_API_KEY") };
    const errors: string[] = [];
    let trending: MediaCandidate[] = [];
    if (useTrending) {
      try { trending = await fetchTrendingCandidates(keys); }
      catch { errors.push("Trending providers unavailable; using persona candidates only"); }
    }
    const cache = new Map<string, Promise<any>>();
    const resolve = (title: string, type: string) => {
      const id = mediaKey({ title, type });
      if (!cache.has(id)) cache.set(id, resolveMediaCandidate(title, type, keys));
      return cache.get(id)!;
    };
    const candidates = new Map();
    // Four candidate jobs at a time avoids provider bursts. Each completed writing assignment sees batch state.
    for (let start = 0; start < personas.length; start += 4) {
      await Promise.all(personas.slice(start, start + 4).map(async p => {
        try { candidates.set(p.id, await buildPersonaCandidates(p, trending, recent, chat, resolve)); }
        catch { errors.push(`${p.display_name}: candidate selection failed`); candidates.set(p.id, []); }
      }));
    }
    const generated = await generatePersonaBatch({ personas, postsPerPersona, weights, recent, candidates, chat, deadline: Date.now() + 105000 });
    errors.push(...generated.errors);
    const drafts = [];
    for (const draft of generated.drafts) {
      // This branch is the only draft write. Dry runs never insert/update/delete any database content.
      if (dryRun) { drafts.push(draft); continue; }
      const { persona_user_name, persona_display_name, ...stored } = draft;
      const { data: inserted, error } = await db.from("persona_post_drafts").insert(stored).select("id").single();
      if (error) errors.push(`${persona_display_name}: draft could not be saved`);
      else drafts.push({ ...draft, id: inserted.id });
    }
    return response({ success: drafts.length > 0, generated: drafts.length, requested: personas.length * postsPerPersona, drafts, dryRun, errors: errors.length ? errors : undefined });
  } catch (error) {
    // Never include upstream request URLs, provider keys, or raw credential-bearing errors.
    return response({ error: error instanceof Error ? error.message : "Generation failed" }, 400);
  }
});