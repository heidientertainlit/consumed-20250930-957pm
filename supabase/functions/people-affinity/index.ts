import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AFFINITY_ALGORITHM_VERSION, scoreAffinitySignals } from "../_shared/affinity-score.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const pair = (a: string, b: string) => a < b ? [a, b] : [b, a];
const BAND_DEFINITIONS = [
  { id: "your-people", label: "80–100%", min: 80, max: 100, feeling: "Closest matches" },
  { id: "same-wavelength", label: "60–79%", min: 60, max: 79, feeling: "Strong overlap" },
  { id: "common-ground", label: "40–59%", min: 40, max: 59, feeling: "Some common ground" },
  { id: "wildcards", label: "Under 40%", min: 0, max: 39, feeling: "Different perspectives" },
] as const;
const emptyBandPeople = () => ({
  "your-people": [] as any[], "same-wavelength": [] as any[],
  "common-ground": [] as any[], wildcards: [] as any[],
});
const serializeBands = (people: ReturnType<typeof emptyBandPeople>) =>
  BAND_DEFINITIONS.map((band) => ({ ...band, people: people[band.id] }));

async function trackedCounts(db: any, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const output = new Map(ids.map((id) => [id, 0]));
  // Keep each PostgREST URL bounded and page through the server's row cap.
  // list_items already carries user_id, so resolving hundreds of list IDs first
  // only makes the request larger without improving the count.
  for (let start = 0; start < ids.length; start += 25) {
    const userIds = ids.slice(start, start + 25);
    for (let offset = 0; ; offset += 1000) {
      const { data: items, error: itemsError } = await db.from("list_items")
        .select("user_id")
        .in("user_id", userIds)
        .range(offset, offset + 999);
      if (itemsError) throw new Error(`Could not load tracked items: ${itemsError.message}`);
      for (const item of items || []) output.set(item.user_id, (output.get(item.user_id) || 0) + 1);
      if ((items || []).length < 1000) break;
    }
  }
  return output;
}

async function sharedTitles(db: any, a: string, b: string) {
  const { data, error } = await db.from("media_ratings")
    .select("user_id,media_title,media_type,rating")
    .in("user_id", [a, b])
    .gte("rating", 4);
  if (error) throw new Error(`Could not load shared titles: ${error.message}`);
  const loved = new Map<string, Map<string, any>>();
  for (const item of data || []) if (item.media_title) {
    if (!loved.has(item.user_id)) loved.set(item.user_id, new Map());
    loved.get(item.user_id)!.set(item.media_title.toLowerCase(), item);
  }
  const left = loved.get(a) || new Map(), right = loved.get(b) || new Map();
  return [...right].filter(([title]) => left.has(title)).slice(0, 10).map(([, item]) => ({ title: item.media_title, media_type: item.media_type }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "A JSON request body is required" }, 400);
    if (!["load", "more"].includes(body.action)) return json({ error: "action must be load or more" }, 400);

    const { data: me, error: meError } = await db.from("users").select("id").eq("id", user.id).maybeSingle();
    if (meError || !me) return json({ error: `Could not load your account: ${meError?.message || "account not found"}` }, 500);
    const myId = me.id;
    const [{ data: myProfile, error: profileError }, mySignalsResult, myEligibilityResult] = await Promise.all([
      db.from("dna_profiles").select("id,label,tagline").eq("user_id", myId).maybeSingle(),
      db.from("user_dna_signals").select("signal_type,signal_value,strength").eq("user_id", myId),
      db.from("people_affinity_eligibility").select("tracked_items").eq("user_id", myId).maybeSingle(),
    ]);
    if (profileError) return json({ error: `Could not load your DNA profile: ${profileError.message}` }, 500);
    if (mySignalsResult.error) return json({ error: `Could not load your DNA signals: ${mySignalsResult.error.message}` }, 500);
    if (myEligibilityResult.error) return json({ error: `Could not load your tracking readiness: ${myEligibilityResult.error.message}` }, 500);
    const mySignals = mySignalsResult.data || [];
    const batchSize = Math.min(25, Math.max(1, Number(body.batch_size) || 25));
    const requestedCursor = body.action === "more" && body.cursor && typeof body.cursor === "object"
      ? { friend: !!body.cursor.friend, id: String(body.cursor.id || "") }
      : null;
    if (body.action === "more" && !requestedCursor?.id) {
      return json({ error: "cursor must identify the last candidate" }, 400);
    }
    const myCount = Number(myEligibilityResult.data?.tracked_items || 0);
    const readiness = {
      has_dna_profile: !!myProfile,
      has_survey: !!myProfile,
      tracked_items: myCount,
      item_count: myCount,
      required_tracked_items: 10,
      items_needed: Math.max(0, 10 - myCount),
      ready: !!myProfile && myCount >= 10,
    };
    if (!readiness.ready) {
      return json({ ready: false, readiness, discoverable: true, bands: serializeBands(emptyBandPeople()), compared_now: 0, has_more: false, next_cursor: null });
    }

    const { data: candidateRows, error: candidatesError } = await db.rpc("get_people_affinity_candidates", {
      p_user_id: myId,
      p_after_friend: requestedCursor?.friend ?? null,
      p_after_id: requestedCursor?.id || null,
      p_limit: batchSize + 1,
    });
    if (candidatesError) return json({ error: `Could not load affinity candidates: ${candidatesError.message}` }, 500);
    const hasMore = (candidateRows || []).length > batchSize;
    const ordered = (candidateRows || []).slice(0, batchSize);
    const candidateIds = ordered.map((person: any) => person.id);
    if (!candidateIds.length) {
      return json({ ready: true, readiness, discoverable: true, bands: serializeBands(emptyBandPeople()), compared_now: 0, has_more: false, next_cursor: null });
    }

    const comparisonRows: any[] = [];
    const freshAfter = new Date().toISOString();
    const [from, to] = await Promise.all([
      db.from("dna_comparisons").select("*").eq("user_id_1", myId).in("user_id_2", candidateIds).gte("expires_at", freshAfter),
      db.from("dna_comparisons").select("*").eq("user_id_2", myId).in("user_id_1", candidateIds).gte("expires_at", freshAfter),
    ]);
    if (from.error || to.error) return json({ error: `Could not load cached comparisons: ${(from.error || to.error)?.message}` }, 500);
    comparisonRows.push(...(from.data || []), ...(to.data || []));
    const comparisons = new Map<string, any>();
    for (const row of comparisonRows) {
      if (row.insights?.algorithm_version === AFFINITY_ALGORITHM_VERSION) {
        comparisons.set(row.user_id_1 === myId ? row.user_id_2 : row.user_id_1, row);
      }
    }
    const missing = ordered.filter((person: any) => !comparisons.has(person.id));
    let comparedNow = 0;
    if (missing.length) {
      const signalIds = [myId, ...missing.map((p: any) => p.id)];
      const { data: freshSignals, error: freshSignalsError } = await db.from("user_dna_signals").select("user_id,signal_type,signal_value,strength").in("user_id", signalIds);
      if (freshSignalsError) return json({ error: `Could not load comparison signals: ${freshSignalsError.message}` }, 500);
      const grouped = new Map<string, any[]>(); for (const s of freshSignals || []) grouped.set(s.user_id, [...(grouped.get(s.user_id) || []), s]);
      await Promise.all(missing.map(async (person: any) => {
        const evidence = scoreAffinitySignals(grouped.get(myId) || [], grouped.get(person.id) || []);
        const [user_id_1, user_id_2] = pair(myId, person.id);
        const row = { user_id_1, user_id_2, ...evidence, shared_titles: await sharedTitles(db, myId, person.id), computed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() };
        const { error: deleteError } = await db.from("dna_comparisons").delete().eq("user_id_1", user_id_2).eq("user_id_2", user_id_1);
        if (deleteError) throw deleteError;
        const { data: saved, error } = await db.from("dna_comparisons")
          .upsert(row, { onConflict: "user_id_1,user_id_2" }).select().single();
        if (error || !saved) throw new Error(`Could not save comparison: ${error?.message || "no comparison returned"}`);
        comparisons.set(person.id, saved);
        comparedNow += 1;
      }));
    }
    const result = emptyBandPeople();
    for (const person of ordered) {
      const c = comparisons.get(person.id); if (!c) continue;
      const score = Number(c.match_score);
      const key = score >= 80 ? "your-people" : score >= 60 ? "same-wavelength" : score >= 40 ? "common-ground" : "wildcards";
      result[key].push({
        id: person.id,
        user_name: person.user_name,
        display_name: person.display_name,
        first_name: person.first_name,
        last_name: person.last_name,
        avatar_url: person.avatar,
        dna_label: person.profile_label,
        dna_tagline: person.profile_tagline,
        match_score: score,
        is_friend: !!person.is_friend,
        relationship: person.is_friend ? "friend" : "discovery",
        shared_titles: c.shared_titles || [],
        shared_genres: c.shared_genres || [],
        shared_creators: c.shared_creators || [],
        differences: c.differences || {},
        insights: c.insights || {},
      });
    }
    for (const band of Object.values(result)) {
      band.sort((a: any, b: any) =>
        Number(b.is_friend) - Number(a.is_friend)
        || Number(b.match_score) - Number(a.match_score)
        || String(a.id).localeCompare(String(b.id)));
    }
    const lastCandidate = ordered[ordered.length - 1];
    const nextCursor = hasMore && lastCandidate
      ? { friend: !!lastCandidate.is_friend, id: lastCandidate.id }
      : null;
    return json({
      ready: true,
      readiness,
      discoverable: true,
      bands: serializeBands(result),
      compared_now: comparedNow,
      has_more: hasMore,
      next_cursor: nextCursor,
    });
  } catch (error: any) {
    console.error("people-affinity:", error);
    return json({ error: error?.message || "Affinity request failed" }, 500);
  }
});