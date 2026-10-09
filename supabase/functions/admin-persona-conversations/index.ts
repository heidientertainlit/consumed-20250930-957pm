import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeAdminOrService } from "../_shared/authorization.ts";
import { boundedInteger, conversationPrompt, PERSONA_GENDERS, text, UUID, validateConversation, validateRoster } from "../_shared/persona-conversation.ts";
import { conversationTrends, storeConversationSubject } from "../_shared/persona-conversation-sources.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...headers, "Content-Type": "application/json" } });
async function moderate(key: string, content: string[]) {
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input: content }),
  });
  if (!res.ok) throw new Error("Moderation unavailable; nothing approved or generated");
  const payload = await res.json();
  if (!Array.isArray(payload.results) || payload.results.length !== content.length || payload.results.some((r: any) => typeof r.flagged !== "boolean" || r.flagged)) throw new Error("Content did not pass moderation");
}
async function write(key: string, prompts: { role: string; content: string }[], tokens: number) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(45000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", temperature: .8, max_tokens: tokens, response_format: { type: "json_object" }, messages: prompts }),
  });
  if (!res.ok) throw new Error(`Writing provider unavailable (${res.status})`);
  try { return JSON.parse((await res.json()).choices[0].message.content); }
  catch { throw new Error("Writing provider returned invalid JSON"); }
}
async function reviewEvidence(key: string, run: any, messages: unknown) {
  const verdict = await write(key, [
    { role: "system", content: "Return JSON {\"issues\":[]} after checking EVERY message. Report unsupported precise events, episodes, lyrics, quotes, releases, personal facts, wrong subject, or incoherent parent responses. Only supplied evidence may support claims. General subjective reactions are allowed." },
    { role: "user", content: JSON.stringify({ subject: run.subject, topic: run.topic, angle: run.angle, explicitlySuppliedContext: run.context, messages }) },
  ], 1500);
  if (!Array.isArray(verdict.issues) || verdict.issues.length) throw new Error("Conversation failed subject/context review; revise or provide more specific context");
}
serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return response({ error: "POST required" }, 405);
  try {
    const auth = await authorizeAdminOrService(req);
    if (!auth.authorized) return response({ error: auth.error }, auth.status);
    if (auth.caller !== "admin" || !auth.userId) return response({ error: "An administrator session is required" }, 403);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const body = await req.json(); const action = body.action;
    const key = Deno.env.get("OPENAI_API_KEY");
    const checked = async (result: any) => { if (result.error) throw new Error("Private conversation database operation failed"); return result.data; };
    const loadPeople = async (ids?: string[]) => {
      let q = db.from("users").select("id,user_name,display_name,persona_config").eq("is_persona", true).order("display_name");
      if (ids) q = q.in("id", ids);
      const people = await checked(await q.limit(500));
      if (ids && people.length !== ids.length) throw new Error("Every participant must be an existing persona");
      if (people.some((p: any) => !p.persona_config)) throw new Error("Persona configuration missing");
      return people;
    };
    if (action === "state") {
      const [personas, genders, runs] = await Promise.all([
        loadPeople(), checked(await db.from("persona_conversation_gender").select("*")),
        checked(await db.from("persona_conversation_runs").select("*").order("created_at", { ascending: false }).limit(50)),
      ]);
      return response({ personas: personas.map((p: any) => ({ ...p, gender: genders.find((g: any) => g.persona_id === p.id)?.gender || "unset" })), runs });
    }
    if (action === "gender") {
      if (!UUID.test(body.personaId) || !PERSONA_GENDERS.includes(body.gender)) throw new Error("Valid persona and explicit fictional gender required");
      await loadPeople([body.personaId]);
      await checked(await db.from("persona_conversation_gender").upsert({ persona_id: body.personaId, gender: body.gender }));
      return response({ success: true });
    }
    if (action === "suggest") {
      const trends = await conversationTrends(db, { tmdb: Deno.env.get("TMDB_API_KEY") });
      if (!trends.suggestions.length) return response(trends);
      if (!key) throw new Error("AI suggestions require the writing and moderation provider");
      const angles = await write(key, [
        { role: "system", content: "Return valid JSON {\"suggestions\":[{\"id\":\"supplied UUID\",\"topic\":\"subjective discussion question\"}]}. Write one concrete conversation question for each exact supplied title. Use supplied provider summaries only; invent no news, release, episode, lyric, character, or event facts. No other titles or IDs. Trends mean provider weekly-list membership only." },
        { role: "user", content: JSON.stringify(trends.suggestions.map(s => ({ id: s.id, subject: s.subject }))) },
      ], 2500);
      if (!Array.isArray(angles.suggestions) || angles.suggestions.length !== trends.suggestions.length ||
          new Set(angles.suggestions.map((s: any) => s.id)).size !== trends.suggestions.length) throw new Error("AI suggestions did not preserve verified subjects; retry");
      for (const idea of angles.suggestions) {
        const selected = trends.suggestions.find(s => s.id === idea.id);
        if (!selected) throw new Error("AI returned an unknown subject");
        idea.topic = text(idea.topic, 5, 500, "Suggested topic");
        selected.topic = idea.topic;
      }
      await reviewEvidence(key, { subject: trends.suggestions.map(s => ({ id: s.id, ...s.subject })), topic: "", angle: "", context: "" }, angles.suggestions);
      await moderate(key, trends.suggestions.map(s => s.topic));
      for (const suggestion of trends.suggestions) {
        await checked(await db.from("persona_conversation_subjects").update({ topic: suggestion.topic }).eq("id", suggestion.id));
      }
      return response(trends);
    }
    if (action === "search") {
      const query = text(body.query, 2, 120, "Search query");
      const supportedTypes = ["movie", "tv", "book", "music", "podcast", "youtube"];
      if (body.type !== "all" && !supportedTypes.includes(body.type)) throw new Error("Choose a supported media type");
      // Reuse the existing verified provider search; never trust browser IDs/titles.
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/media-search`, {
        method: "POST", signal: AbortSignal.timeout(25000),
        headers: { Authorization: req.headers.get("Authorization")!, "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
        // media-search treats ONLY an absent type as all providers; "all" is
        // a studio UI value, not a provider-search category.
        body: JSON.stringify({ query, ...(body.type === "all" ? {} : { type: body.type }) }),
      });
      if (!res.ok) throw new Error("Media search unavailable; retry or use a free topic");
      const payload = await res.json();
      const results = Array.isArray(payload) ? payload : payload.results || [];
      const items = []; const coverage = [];
      for (const item of results.filter((r: any) => supportedTypes.includes(r.type?.toLowerCase()) && (body.type === "all" || r.type?.toLowerCase() === body.type) && r.external_source && r.external_source !== "openai" && r.external_id).slice(0, 8)) {
        try {
          const stored = await storeConversationSubject(db, { title: item.title, type: item.type.toLowerCase(), creator: item.creator,
            externalId: String(item.external_id), externalSource: item.external_source, description: item.description },
          [{ provider: item.external_source, fetchedAt: new Date().toISOString(), claim: "Verified manual provider selection, not a trend" }]);
          items.push({ id: stored.id, ...stored.subject });
        } catch { coverage.push({ provider: item.external_source, status: "failed", error: "A search result could not be verified and was omitted" }); }
      }
      return response({ items, coverage });
    }
    let run: any;
    if (body.runId) {
      if (!UUID.test(body.runId)) throw new Error("Valid run ID required");
      run = await checked(await db.from("persona_conversation_runs").select("*").eq("id", body.runId).single());
      if (run.revision !== body.revision) throw new Error("Draft changed; refresh before continuing");
    }
    if (action === "generate" || action === "regenerate") {
      if (!key) return response({ error: "Writing provider not configured" }, 503);
      if (action === "regenerate" && (!run || !["draft", "approved", "paused"].includes(run.status) || run.last_delivered_at)) throw new Error("Cannot regenerate an active or delivered conversation");
      const ids = validateRoster(run?.participant_ids || body.participantIds, run?.opening_author_id || body.openingAuthorId);
      const opening = run?.opening_author_id || body.openingAuthorId;
      const people = await loadPeople(ids);
      const count = run ? run.messages.length : boundedInteger(body.replyCount, 2, 19, "Reply count") + 1;
      const duration = run ? run.messages.at(-1).offset_seconds : boundedInteger(body.durationMinutes, 5, 10080, "Duration minutes") * 60;
      if (duration < (count - 1) * 60) throw new Error("Duration must allow at least one minute between messages");
      const maxWords = run?.max_words || boundedInteger(body.maxWords, 10, 120, "Maximum words");
      let topic = run?.topic || (body.suggestionId ? "" : text(body.topic, 5, 500, "Topic"));
      let subject = run?.subject || null; let provenance = run?.provenance || [];
      if (!run && (body.subjectId || body.suggestionId)) {
        const id = body.suggestionId || body.subjectId;
        if (!UUID.test(id)) throw new Error("Select a verified subject");
        const selected = await checked(await db.from("persona_conversation_subjects").select("*").eq("id", id).gt("expires_at", new Date().toISOString()).single());
        subject = selected.subject; provenance = selected.provenance;
        if (body.suggestionId) topic = text(selected.topic, 5, 500, "Sourced topic");
      }
      const angle = run?.angle ?? text(body.angle || "", 0, 500, "Angle");
      const context = run?.context ?? text(body.context || "", 0, 2000, "Supplied context");
      await moderate(key, [topic, angle, context].filter(Boolean));
      const prompts = conversationPrompt({ topic, angle, context, subject, provenance, personas: people, opening, count, durationSeconds: duration, maxWords });
      const result = await write(key, prompts, Math.min(12000, count * (maxWords * 2 + 150)));
      const messages = validateConversation(result.messages, ids, opening, count);
      if (messages.at(-1)!.offset_seconds !== duration || messages.some(m => m.body.split(/\s+/).length > maxWords)) throw new Error("Generated timing or message length exceeded selected controls; regenerate");
      await moderate(key, messages.map(m => m.body));
      // One bounded factual review; the standalone writer is not involved.
      await reviewEvidence(key, { subject, topic, angle, context }, messages);
      if (run) {
        const updated = await checked(await db.rpc("manage_persona_conversation", { p_admin: auth.userId, p_action: "regenerate", p_run: run.id, p_revision: body.revision, p_payload: { messages } }));
        return response(updated);
      }
      const saved = await checked(await db.from("persona_conversation_runs").insert({ created_by: auth.userId, topic, angle, context, subject, provenance, participant_ids: ids, opening_author_id: opening, max_words: maxWords, messages }).select("*").single());
      return response(saved);
    }
    if (!run || !["edit", "approve", "schedule", "pause", "cancel", "reject"].includes(action)) throw new Error("Unknown action or missing run");
    if (action === "edit" || action === "approve") {
      if (!key) throw new Error("Moderation provider not configured");
      const messages = validateConversation(action === "edit" ? body.messages : run.messages, run.participant_ids, run.opening_author_id);
      if (messages.some(m => m.body.split(/\s+/).length > run.max_words)) throw new Error("Edited message exceeds the saved word limit");
      await moderate(key, messages.map(m => m.body));
      await reviewEvidence(key, run, messages);
      if (action === "edit") body.messages = messages;
    }
    const updated = await checked(await db.rpc("manage_persona_conversation", {
      p_admin: auth.userId, p_action: action, p_run: run.id, p_revision: body.revision,
      p_payload: action === "edit" ? { messages: body.messages } : { startAt: body.startAt },
    }));
    return response(updated);
  } catch (error) {
    // Provider errors are intentionally generic: no keys, URLs or raw DB detail.
    return response({ error: error instanceof Error ? error.message : "Conversation request failed" }, 400);
  }
});
