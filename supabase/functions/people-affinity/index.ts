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
  { id: "your-people", label: "65–100%", min: 65, max: 100, feeling: "Your People" },
  { id: "common-ground", label: "35–64%", min: 35, max: 64, feeling: "Common Ground" },
  { id: "wildcards", label: "0–34%", min: 0, max: 34, feeling: "Different Vibes" },
] as const;
const emptyBandPeople = () => ({
  "your-people": [] as any[],
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

function sharedTitles(data: any[], a: string, b: string) {
  const loved = new Map<string, Map<string, any>>();
  for (const item of data || []) if (item.media_title) {
    if (!loved.has(item.user_id)) loved.set(item.user_id, new Map());
    loved.get(item.user_id)!.set(item.media_title.toLowerCase(), item);
  }
  const left = loved.get(a) || new Map(), right = loved.get(b) || new Map();
  return [...right].filter(([title]) => left.has(title)).slice(0, 10).map(([, item]) => ({
    title: item.media_title,
    media_type: item.media_type,
    external_id: item.media_external_id,
    external_source: item.media_external_source,
  }));
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
    if (!["load", "more", "score"].includes(body.action)) return json({ error: "action must be load, more, or score" }, 400);

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

    if (body.action === "score") {
      const candidateId = String(body.person_id || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateId)) {
        return json({ error: "person_id must be a valid user ID" }, 400);
      }
      const { data: candidates, error: candidateError } = await db.rpc("get_people_affinity_candidate", {
        p_user_id: myId,
        p_candidate_id: candidateId,
      });
      if (candidateError) return json({ error: `Could not load this person: ${candidateError.message}` }, 500);
      const candidate = candidates?.[0];
      if (!candidate) return json({ ready: true, person: null });

      const [userId1, userId2] = pair(myId, candidateId);
      const freshAfter = new Date().toISOString();
      const { data: cached, error: cachedError } = await db.from("dna_comparisons")
        .select("*")
        .eq("user_id_1", userId1)
        .eq("user_id_2", userId2)
        .gte("expires_at", freshAfter)
        .maybeSingle();
      if (cachedError) return json({ error: `Could not load cached comparison: ${cachedError.message}` }, 500);

      let comparison = cached?.insights?.algorithm_version === AFFINITY_ALGORITHM_VERSION ? cached : null;
      if (!comparison) {
        const [signalsResult, ratingsResult] = await Promise.all([
          db.from("user_dna_signals")
            .select("user_id,signal_type,signal_value,strength")
            .in("user_id", [myId, candidateId]),
          db.from("media_ratings")
            .select("user_id,media_title,media_type,media_external_id,media_external_source,rating")
            .in("user_id", [myId, candidateId])
            .gte("rating", 4),
        ]);
        if (signalsResult.error) return json({ error: `Could not load comparison signals: ${signalsResult.error.message}` }, 500);
        if (ratingsResult.error) return json({ error: `Could not load shared titles: ${ratingsResult.error.message}` }, 500);
        const signals = signalsResult.data || [];
        const evidence = scoreAffinitySignals(
          signals.filter((signal: any) => signal.user_id === myId),
          signals.filter((signal: any) => signal.user_id === candidateId),
        );
        const row = {
          user_id_1: userId1,
          user_id_2: userId2,
          ...evidence,
          shared_titles: sharedTitles(ratingsResult.data || [], myId, candidateId),
          computed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        };
        const { data: saved, error: saveError } = await db.from("dna_comparisons")
          .upsert(row, { onConflict: "user_id_1,user_id_2" })
          .select()
          .single();
        if (saveError || !saved) return json({ error: `Could not save comparison: ${saveError?.message || "no comparison returned"}` }, 500);
        comparison = saved;
      }

      return json({
        ready: true,
        person: {
          id: candidate.id,
          match_score: Number(comparison.match_score),
          shared_titles: comparison.shared_titles || [],
          shared_genres: comparison.shared_genres || [],
          shared_creators: comparison.shared_creators || [],
        },
      });
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
      const [freshSignalsResult, ratingsResult] = await Promise.all([
        db.from("user_dna_signals").select("user_id,signal_type,signal_value,strength").in("user_id", signalIds),
        db.from("media_ratings")
          .select("user_id,media_title,media_type,media_external_id,media_external_source,rating")
          .in("user_id", signalIds)
          .gte("rating", 4),
      ]);
      if (freshSignalsResult.error) return json({ error: `Could not load comparison signals: ${freshSignalsResult.error.message}` }, 500);
      if (ratingsResult.error) return json({ error: `Could not load shared titles: ${ratingsResult.error.message}` }, 500);
      const freshSignals = freshSignalsResult.data || [];
      const grouped = new Map<string, any[]>(); for (const s of freshSignals || []) grouped.set(s.user_id, [...(grouped.get(s.user_id) || []), s]);
      const rows = missing.map((person: any) => {
        const evidence = scoreAffinitySignals(grouped.get(myId) || [], grouped.get(person.id) || []);
        const [user_id_1, user_id_2] = pair(myId, person.id);
        return {
          user_id_1,
          user_id_2,
          ...evidence,
          shared_titles: sharedTitles(ratingsResult.data || [], myId, person.id),
          computed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        };
      });
      const missingIds = missing.map((person: any) => person.id);
      const [forwardDelete, reverseDelete] = await Promise.all([
        db.from("dna_comparisons").delete().eq("user_id_1", myId).in("user_id_2", missingIds),
        db.from("dna_comparisons").delete().in("user_id_1", missingIds).eq("user_id_2", myId),
      ]);
      if (forwardDelete.error || reverseDelete.error) throw forwardDelete.error || reverseDelete.error;
      const { data: savedRows, error: saveError } = await db.from("dna_comparisons")
        .upsert(rows, { onConflict: "user_id_1,user_id_2" })
        .select();
      if (saveError || !savedRows) throw new Error(`Could not save comparisons: ${saveError?.message || "no comparisons returned"}`);
      for (const saved of savedRows) {
        comparisons.set(saved.user_id_1 === myId ? saved.user_id_2 : saved.user_id_1, saved);
      }
      comparedNow = savedRows.length;
    }
    const featuredPosterPeople = ordered
      .filter((person: any) => comparisons.has(person.id))
      .sort((a: any, b: any) => Number(comparisons.get(b.id)?.match_score || 0) - Number(comparisons.get(a.id)?.match_score || 0))
      .slice(0, 2);
    const sharedTitleValues = [...new Set(
      featuredPosterPeople
        .map((person: any) => comparisons.get(person.id))
        .flatMap((comparison: any) => comparison.shared_titles || [])
        .map((item: any) => typeof item === "string" ? item : item.title)
        .filter(Boolean),
    )];
    const sharedImageByTitle = new Map<string, string>();
    if (sharedTitleValues.length) {
      const { data: sharedMedia, error: sharedMediaError } = await db
        .from("list_items")
        .select("title,image_url")
        .in("user_id", [myId, ...featuredPosterPeople.map((person: any) => person.id)])
        .in("title", sharedTitleValues)
        .not("image_url", "is", null);
      if (sharedMediaError) throw new Error(`Could not load shared title artwork: ${sharedMediaError.message}`);
      for (const item of sharedMedia || []) {
        if (item.title && item.image_url && !sharedImageByTitle.has(item.title.toLowerCase())) {
          sharedImageByTitle.set(item.title.toLowerCase(), item.image_url);
        }
      }
    }
    const result = emptyBandPeople();
    for (const person of ordered) {
      const c = comparisons.get(person.id); if (!c) continue;
      const score = Number(c.match_score);
      const key = score >= 65 ? "your-people" : score >= 35 ? "common-ground" : "wildcards";
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
        shared_titles: (c.shared_titles || []).map((item: any) => {
          const normalized = typeof item === "string" ? { title: item } : item;
          return {
            ...normalized,
            image_url: normalized.title ? sharedImageByTitle.get(normalized.title.toLowerCase()) || null : null,
          };
        }),
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