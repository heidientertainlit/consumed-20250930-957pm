// POST contract (all actions require an administrator bearer token):
// list-state {roomId}; suggest-topics {roomId}; assemble-personas {roomId};
// provision-personas {roomId, personaIds?}; generate-preview {roomId, topic,
// suggestionId?, participantIds}; publish {runId}. Draft text is never public.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unsafe = /\b(minor|child|children|teen(?:ager)?|sexual assault|rape|graphic|gore|autopsy|ongoing investigation|active case|missing person|unconfirmed|rumou?r|alleged)\b/i;
const timeoutFetch = (url: string, ms = 4500) => fetch(url, { signal: AbortSignal.timeout(ms) });
const cleanTopic = (value: unknown) => {
  const topic = String(value || "").replace(/\s+/g, " ").trim();
  return topic.length >= 10 && topic.length <= 280 && !unsafe.test(topic) ? topic : null;
};
const validateMessages = (messages: any[], participantIds: string[]) => {
  if (!Array.isArray(messages) || messages.length !== 20) return { ok: false as const, error: "Exactly 20 messages are required" };
  if (participantIds.length !== 20 || new Set(participantIds).size !== 20) return { ok: false as const, error: "Exactly 20 distinct participants are required" };
  if (new Set(messages.map(message => message.participant_id)).size !== 20) return { ok: false as const, error: "Every participant must appear exactly once" };
  if (new Set(messages.map(message => message.client_id)).size !== 20) return { ok: false as const, error: "Every message needs a distinct client id" };
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (!participantIds.includes(String(message.participant_id))) return { ok: false as const, error: "A message uses an unapproved participant" };
    if (!/^[a-z0-9_-]{1,64}$/.test(String(message.client_id || ""))) return { ok: false as const, error: "A message has an invalid client id" };
    if (typeof message.body !== "string" || message.body.trim().length < 1 || message.body.trim().length > 1200 || unsafe.test(message.body)) return { ok: false as const, error: "A message failed content safety validation" };
    if (index === 0 && message.parent_client_id != null) return { ok: false as const, error: "The opening message cannot have a parent" };
    if (index > 0 && !messages.slice(0, index).some(parent => parent.client_id === message.parent_client_id)) return { ok: false as const, error: "A reply parent must appear earlier in the conversation" };
  }
  return { ok: true as const };
};
const moderate = async (input: string) => {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return { ok: false as const, error: "OpenAI moderation is not configured" };
  const result = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input }),
  });
  if (!result.ok) return { ok: false as const, error: "Content could not be safety-checked" };
  const payload = await result.json();
  if (payload.results?.some((item: any) => item.flagged)) return { ok: false as const, error: "Content did not pass safety review" };
  return { ok: true as const };
};

async function topicSuggestions() {
  const out: { topic: string; summary: string; source: string; url: string; publishedAt: string | null }[] = [];
  const tmdb = Deno.env.get("TMDB_API_KEY");
  const nyt = Deno.env.get("NYT_API_KEY");
  const requests: Promise<void>[] = [];
  if (tmdb) requests.push((async () => {
    const keywordResponse = await timeoutFetch(`https://api.themoviedb.org/3/search/keyword?api_key=${encodeURIComponent(tmdb)}&query=true%20crime`);
    if (!keywordResponse.ok) return;
    const keywordData = await keywordResponse.json();
    const keywordId = keywordData.results?.find((item: any) => String(item.name).toLowerCase() === "true crime")?.id;
    if (!keywordId) return;
    const [tvResponse, movieResponse] = await Promise.all([
      timeoutFetch(`https://api.themoviedb.org/3/discover/tv?api_key=${encodeURIComponent(tmdb)}&with_genres=99&with_keywords=${keywordId}&sort_by=popularity.desc`),
      timeoutFetch(`https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(tmdb)}&with_genres=99&with_keywords=${keywordId}&sort_by=popularity.desc`),
    ]);
    for (const [kind, result] of [["tv", tvResponse], ["movie", movieResponse]] as const) {
      if (!result.ok) continue;
      const data = await result.json();
      for (const item of (data.results || []).slice(0, 6)) {
        const title = String(item.name || item.title || "").trim();
        const summary = String(item.overview || "").replace(/\s+/g, " ").trim();
        const topic = cleanTopic(`Did ${title} handle its evidence and subjects responsibly?`);
        if (topic && !unsafe.test(summary)) out.push({
          topic,
          summary: summary.slice(0, 240),
          source: "TMDB",
          url: `https://www.themoviedb.org/${kind}/${item.id}`,
          publishedAt: item.first_air_date || item.release_date || null,
        });
      }
    }
  })().catch(() => {}));
  if (nyt) requests.push(timeoutFetch(`https://api.nytimes.com/svc/search/v2/articlesearch.json?q=true%20crime%20documentary%20podcast&fq=section_name:(%22Arts%22%20%22Movies%22%20%22Books%22)&sort=newest&api-key=${encodeURIComponent(nyt)}`)
    .then(async r => {
      if (!r.ok) return;
      const data = await r.json();
      for (const item of (data.response?.docs || []).slice(0, 8)) {
        const headline = String(item.headline?.main || "").trim();
        const summary = String(item.abstract || item.snippet || "").replace(/\s+/g, " ").trim();
        if (!/documentary|docuseries|podcast|series|film|book/i.test(`${headline} ${summary}`) || unsafe.test(`${headline} ${summary}`)) continue;
        const topic = cleanTopic(`What does ${headline} add to the way this story has been told?`);
        if (topic) out.push({ topic, summary: summary.slice(0, 240), source: "The New York Times", url: item.web_url || "", publishedAt: item.pub_date || null });
      }
    }).catch(() => {}));
  await Promise.all(requests);
  const seen = new Set<string>();
  const fetchedAt = new Date().toISOString();
  return out
    .filter(item => !unsafe.test(`${item.topic} ${item.summary}`) && !seen.has(item.topic.toLowerCase()) && seen.add(item.topic.toLowerCase()))
    .slice(0, 10)
    .map(item => ({ ...item, fetchedAt, safety: "Safety-screened" }));
}

const curated = [
  ["casefile_notes", "Casefile Notes", "careful and evidence-focused"], ["doculedger", "Documentary Ledger", "measured documentary critic"],
  ["podcastproof", "Podcast Proof", "curious audio journalist"], ["archivewatch", "Archive Watch", "records-first researcher"],
  ["contextclaire", "Context Claire", "empathetic media analyst"], ["courtroomcut", "Courtroom Cut", "legal-process explainer"],
  ["sourcechecksam", "Source Check Sam", "citation-minded listener"], ["ethicsedit", "Ethics Edit", "victim-centered critic"],
  ["longformlane", "Longform Lane", "patient longform reviewer"], ["factpattern", "Fact Pattern", "methodical fact checker"],
  ["verdictview", "Verdict View", "legal-media observer"], ["listenclosely", "Listen Closely", "thoughtful podcast listener"],
  ["docufocus", "Docu Focus", "documentary craft enthusiast"], ["recordroom", "Record Room", "archival researcher"],
  ["publicfile", "Public File", "public-records reader"], ["narrativelens", "Narrative Lens", "ethical storytelling critic"],
  ["signalnoise", "Signal Noise", "skeptical media analyst"], ["fieldnotes_tc", "Field Notes", "careful reporting fan"],
  ["closedcaseclub", "Closed Case Club", "completed-case discussion host"], ["methodmatters", "Method Matters", "process-focused reviewer"],
];
const rankPersonas = (people: any[]) => people.map(p => {
  const config = JSON.stringify(p.persona_config || {});
  const matches = config.match(/true.?crime|documentar(?:y|ies)|docuseries|podcast|journalism|evidence|courtroom|investigat/gi) || [];
  return { ...p, score: matches.length };
}).filter(p => p.score > 0)
  .sort((a, b) => b.score - a.score || String(a.user_name).localeCompare(String(b.user_name))).slice(0, 20);

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const auth = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return response({ error: "Unauthorized" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", { auth: { persistSession: false } });
    const { data: admin, error: adminError } = await db.from("users").select("id,is_admin").eq("id", user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin?.is_admin) return response({ error: "Administrator authorization required" }, 403);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const roomId = String(body.roomId || "");
    const roomCheck = async () => {
      if (!uuid.test(roomId)) throw new Error("A valid roomId is required");
      const { data, error } = await db.from("pools").select("id,name,series_tag,is_official").eq("id", roomId).maybeSingle();
      if (error) throw error;
      if (!data || !data.is_official || data.series_tag !== "true-crime") throw new Error("Room must be an existing official true-crime room");
      return data;
    };
    if (action === "list-state") {
      const room = await roomCheck();
      const { data: runs, error } = await db.from("admin_room_conversation_runs").select("id,topic,status,published_take_id,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return response({ room, runs });
    }
    if (action === "suggest-topics") {
      await roomCheck();
      const now = new Date().toISOString();
      const { data: cached, error: cacheError } = await db.from("admin_room_topic_suggestions")
        .select("id,topic,summary,source_name,source_url,published_at,fetched_at,safety")
        .eq("room_id", roomId).gt("expires_at", now).order("fetched_at", { ascending: false }).limit(10);
      if (cacheError) throw cacheError;
      if (cached?.length) return response({ suggestions: cached.map(item => ({
        id: item.id,
        topic: item.topic,
        summary: item.summary,
        source: item.source_name,
        url: item.source_url,
        publishedAt: item.published_at,
        fetchedAt: item.fetched_at,
        safety: item.safety,
      })) });
      const live = await topicSuggestions();
      if (!live.length) return response({ suggestions: [] });
      const { data: stored, error: storeError } = await db.from("admin_room_topic_suggestions").insert(live.map(item => ({
        room_id: roomId,
        topic: item.topic,
        summary: item.summary,
        source_name: item.source,
        source_url: item.url,
        published_at: item.publishedAt,
        fetched_at: item.fetchedAt,
        safety: item.safety,
      }))).select("id,topic,summary,source_name,source_url,published_at,fetched_at,safety");
      if (storeError) throw storeError;
      return response({ suggestions: (stored || []).map(item => ({
        id: item.id,
        topic: item.topic,
        summary: item.summary,
        source: item.source_name,
        url: item.source_url,
        publishedAt: item.published_at,
        fetchedAt: item.fetched_at,
        safety: item.safety,
      })) });
    }
    if (action === "assemble-personas" || action === "provision-personas") {
      await roomCheck();
      const { data: all, error } = await db.from("users").select("id,user_name,display_name,persona_config").eq("is_persona", true);
      if (error) throw error;
      const ranked = rankPersonas(all || []);
      if (action === "assemble-personas") return response({ personas: ranked, deficit: Math.max(0, 20 - ranked.length) });
      const approvedDeficit = Number(body.approvedDeficit);
      if (!Number.isInteger(approvedDeficit) || approvedDeficit <= 0) {
        return response({ error: "Persona creation requires explicit exact-deficit approval" }, 409);
      }
      const lockToken = crypto.randomUUID();
      await db.from("admin_room_persona_provision_locks").delete().eq("room_id", roomId)
        .lt("created_at", new Date(Date.now() - 5 * 60_000).toISOString());
      const { error: lockError } = await db.from("admin_room_persona_provision_locks")
        .insert({ room_id: roomId, token: lockToken, created_by: user.id });
      if (lockError?.code === "23505") return response({ error: "Persona provisioning is already in progress" }, 409);
      if (lockError) throw lockError;
      try {
        const { data: freshAll, error: freshError } = await db.from("users")
          .select("id,user_name,display_name,persona_config").eq("is_persona", true);
        if (freshError) throw freshError;
        const freshRanked = rankPersonas(freshAll || []);
        const deficit = Math.max(0, 20 - freshRanked.length);
        if (approvedDeficit !== deficit) {
          return response({ error: "The persona deficit changed; review and approve the new exact deficit", deficit }, 409);
        }
        const used = new Set((freshAll || []).map(p => String(p.user_name)));
        const templates = curated.filter(template => !used.has(template[0])).slice(0, deficit);
        if (templates.length !== deficit) return response({ error: "Not enough approved persona templates to satisfy the exact deficit" }, 409);
        const createdIds: string[] = [];
        for (const [baseName, displayName, tone] of templates) {
          let userName = baseName;
          let suffix = 2;
          while (used.has(userName)) userName = `${baseName}${suffix++}`;
          used.add(userName);
          const email = `${userName}@personas.consumed.invalid`;
          const personaConfig = {
            template_key: baseName,
            bio: "A reusable, safety-first true-crime media persona.",
            tone,
            interests: ["true crime", "documentaries", "podcasts", "investigative journalism"],
            media_types: ["podcast", "tv", "movie", "book"],
            posting_style: "evidence-aware discussion",
          };
          const { data: authUser, error: authCreateError } = await db.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { user_name: userName, username: userName, display_name: displayName },
          });
          if (authCreateError || !authUser.user) throw authCreateError || new Error("Persona identity creation failed");
          const { error: profileError } = await db.from("users").upsert({
            id: authUser.user.id,
            user_name: userName,
            display_name: displayName,
            email,
            is_persona: true,
            persona_config: personaConfig,
          }, { onConflict: "id" });
          if (profileError) {
            await db.auth.admin.deleteUser(authUser.user.id).catch(() => {});
            throw profileError;
          }
          createdIds.push(authUser.user.id);
        }
        const { data: refreshed, error: refreshError } = await db.from("users")
          .select("id,user_name,display_name,persona_config").eq("is_persona", true);
        if (refreshError) throw refreshError;
        const selected = rankPersonas(refreshed || []);
        if (selected.length !== 20 || selected.some(p => !uuid.test(String(p.id)))) return response({ error: "Persona provisioning did not produce 20 valid participants" }, 500);
        return response({ provisioned: createdIds.length, deficit, personas: selected });
      } finally {
        await db.from("admin_room_persona_provision_locks").delete().eq("token", lockToken);
      }
    }
    if (action === "generate-preview") {
      await roomCheck();
      const suggestionId = String(body.suggestionId || "");
      let topic: string | null = null;
      let sources: { source: string; url: string; publishedAt: string | null; fetchedAt: string | null; safety: string }[] = [];
      if (suggestionId) {
        if (!uuid.test(suggestionId)) return response({ error: "A valid suggestionId is required" }, 422);
        const { data: suggestion, error: suggestionError } = await db.from("admin_room_topic_suggestions")
          .select("topic,source_name,source_url,published_at,fetched_at,safety,expires_at")
          .eq("id", suggestionId).eq("room_id", roomId).gt("expires_at", new Date().toISOString()).maybeSingle();
        if (suggestionError) throw suggestionError;
        if (!suggestion) return response({ error: "The sourced starter expired; refresh suggestions" }, 409);
        topic = cleanTopic(suggestion.topic);
        sources = [{
          source: suggestion.source_name,
          url: suggestion.source_url,
          publishedAt: suggestion.published_at,
          fetchedAt: suggestion.fetched_at,
          safety: suggestion.safety,
        }];
      } else {
        topic = cleanTopic(body.topic);
        sources = [{ source: "Admin custom starter", url: "", publishedAt: null, fetchedAt: new Date().toISOString(), safety: "Admin-selected; server safety-reviewed" }];
      }
      if (!topic) return response({ error: "Topic is unsafe or invalid" }, 422);
      const ids = Array.isArray(body.participantIds) ? body.participantIds.map(String) : [];
      if (ids.length !== 20 || new Set(ids).size !== 20 || ids.some(x => !uuid.test(x))) return response({ error: "Exactly 20 distinct participantIds are required" }, 422);
      const { data: people, error } = await db.from("users").select("id,user_name,display_name,persona_config").in("id", ids).eq("is_persona", true);
      if (error) throw error;
      if ((people || []).length !== 20) return response({ error: "Every participant must be an existing persona" }, 422);
      const key = Deno.env.get("OPENAI_API_KEY"); if (!key) return response({ error: "OpenAI is not configured" }, 503);
      const prompt = `Write a safe discussion of this completed-media topic: ${topic}. Never describe graphic harm, speculate about active cases, accuse people, or discuss minors. Return JSON {messages:[{client_id,participant_id,parent_client_id,body}]}; exactly 20 messages, first root then 19 replies, each listed participant exactly once. body 1-1200 chars. Participant ids: ${JSON.stringify(people)}`;
      const openai = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return valid JSON only." }, { role: "user", content: prompt }] }) });
      if (!openai.ok) throw new Error(`OpenAI generation failed (${openai.status})`);
      const parsed = JSON.parse((await openai.json()).choices?.[0]?.message?.content || "{}");
      const messages = parsed.messages;
      const validation = validateMessages(messages, ids);
      if (!validation.ok) return response({ error: `Generated preview failed validation: ${validation.error}` }, 422);
      const moderation = await moderate(messages.map((message: any) => message.body).join("\n\n"));
      if (!moderation.ok) return response({ error: moderation.error }, 422);
      const { data: run, error: runError } = await db.from("admin_room_conversation_runs").insert({ room_id: roomId, created_by: user.id, topic, source_attribution: sources }).select("id").single();
      if (runError) throw runError;
      const { error: draftError } = await db.from("admin_room_conversation_drafts").insert(messages.map((m: any, position: number) => ({ run_id: run.id, client_id: m.client_id, participant_id: m.participant_id, parent_client_id: m.parent_client_id || null, body: m.body.trim(), position })));
      if (draftError) throw draftError;
      return response({ runId: run.id, status: "draft", messages, sourceAttribution: sources });
    }
    if (action === "approve-preview") {
      const runId = String(body.runId || ""); if (!uuid.test(runId)) return response({ error: "A valid runId is required" }, 422);
      await roomCheck();
      const { data: run, error: runError } = await db.from("admin_room_conversation_runs")
        .select("id,status,room_id,approved_at,approved_by").eq("id", runId).eq("room_id", roomId).maybeSingle();
      if (runError) throw runError;
      if (!run || run.status !== "draft") return response({ error: "Draft run not found" }, 404);
      if (run.approved_at) {
        if (run.approved_by !== user.id) return response({ error: "This preview was approved by another admin" }, 409);
        return response({ runId, status: "approved", approvedAt: run.approved_at });
      }
      const { data: drafts, error: draftError } = await db.from("admin_room_conversation_drafts")
        .select("client_id,participant_id,parent_client_id,body,position").eq("run_id", runId).order("position");
      if (draftError) throw draftError;
      const participantIds = [...new Set((drafts || []).map(item => String(item.participant_id)))];
      const messages = (drafts || []).map(item => ({
        client_id: item.client_id,
        participant_id: item.participant_id,
        parent_client_id: item.parent_client_id,
        body: item.body,
      }));
      const validation = validateMessages(messages, participantIds);
      if (!validation.ok) return response({ error: `Draft approval validation failed: ${validation.error}` }, 409);
      const moderation = await moderate(messages.map(message => message.body).join("\n"));
      if (!moderation.ok) return response({ error: `Draft approval moderation failed: ${moderation.error}` }, 422);
      const approvedAt = new Date().toISOString();
      const { data: approved, error: approveError } = await db.from("admin_room_conversation_runs")
        .update({ approved_by: user.id, approved_at: approvedAt })
        .eq("id", runId).eq("status", "draft").is("approved_at", null)
        .select("id").maybeSingle();
      if (approveError) throw approveError;
      if (!approved) return response({ error: "Preview approval changed; refresh before publishing" }, 409);
      return response({ runId, status: "approved", approvedAt });
    }
    if (action === "publish") {
      const runId = String(body.runId || ""); if (!uuid.test(runId)) return response({ error: "A valid runId is required" }, 422);
      const { data, error } = await db.rpc("publish_admin_room_conversation", { p_run_id: runId, p_admin_id: user.id });
      if (error) return response({ error: error.message }, 422);
      return response({ runId, takeId: data, status: "published" });
    }
    return response({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("[admin-room-conversations]", error);
    return response({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});