import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const pair = (a: string, b: string) => a < b ? [a, b] : [b, a];
const BAND_DEFINITIONS = [
  { id: "your-people", label: "Your People", min: 80, max: 100, feeling: "They just get it." },
  { id: "same-wavelength", label: "Same Wavelength", min: 60, max: 79, feeling: "A lot in common." },
  { id: "common-ground", label: "Common Ground", min: 40, max: 59, feeling: "Some overlap. Some surprises." },
  { id: "wildcards", label: "Wildcards", min: 0, max: 39, feeling: "Things could get interesting." },
] as const;
const emptyBandPeople = () => ({
  "your-people": [] as any[], "same-wavelength": [] as any[],
  "common-ground": [] as any[], wildcards: [] as any[],
});
const serializeBands = (people: ReturnType<typeof emptyBandPeople>) =>
  BAND_DEFINITIONS.map((band) => ({ ...band, people: people[band.id] }));

function scoreSignals(left: any[], right: any[]) {
  const a = new Map(left.filter((x) => x.signal_type !== "engagement").map((x) => [`${x.signal_type}:${x.signal_value}`, Number(x.strength)]));
  const b = new Map(right.filter((x) => x.signal_type !== "engagement").map((x) => [`${x.signal_type}:${x.signal_value}`, Number(x.strength)]));
  let score = 0, weight = 0;
  const shared_genres: string[] = [], shared_creators: string[] = [], user_unique: string[] = [], friend_unique: string[] = [];
  for (const [key, strength] of a) {
    const [type, value] = key.split(":");
    if (b.has(key)) {
      score += (1 - Math.abs(strength - (b.get(key) || 0))) * strength;
      weight += strength;
      if (type === "genre") shared_genres.push(value);
      if (type === "creator") shared_creators.push(value);
    } else if (strength > .5) user_unique.push(`${type}: ${value}`);
  }
  for (const [key, strength] of b) if (!a.has(key) && strength > .5) {
    const [type, value] = key.split(":"); friend_unique.push(`${type}: ${value}`);
  }
  return {
    match_score: weight ? Math.round(score / weight * 100) : 50,
    shared_genres: shared_genres.slice(0, 10), shared_creators: shared_creators.slice(0, 10),
    differences: { user_unique: user_unique.slice(0, 5), friend_unique: friend_unique.slice(0, 5) },
  };
}

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
    const [{ data: myProfile, error: profileError }, mySignalsResult] = await Promise.all([
      db.from("dna_profiles").select("id,label,tagline").eq("user_id", myId).maybeSingle(),
      db.from("user_dna_signals").select("signal_type,signal_value,strength").eq("user_id", myId),
    ]);
    if (profileError) return json({ error: `Could not load your DNA profile: ${profileError.message}` }, 500);
    if (mySignalsResult.error) return json({ error: `Could not load your DNA signals: ${mySignalsResult.error.message}` }, 500);
    const mySignals = mySignalsResult.data || [];
    const batchSize = Math.min(5, Math.max(1, Number(body.batch_size) || 5));
    if (body.action === "more" && (!Number.isFinite(Number(body.cursor)) || Number(body.cursor) < 0)) {
      return json({ error: "cursor must be a non-negative number" }, 400);
    }
    const requestedCursor = body.action === "more" ? Math.floor(Number(body.cursor)) : 0;
    const myCount = (await trackedCounts(db, [myId])).get(myId) || 0;
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

    const [{ data: friendRows, error: friendsError }, { data: blockRows, error: blocksError }, { data: signalRows, error: signalsError }] = await Promise.all([
      db.from("friendships").select("user_id,friend_id").eq("status", "accepted").or(`user_id.eq.${myId},friend_id.eq.${myId}`),
      db.from("user_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`),
      db.from("user_dna_signals").select("user_id,signal_type,signal_value,strength").neq("user_id", myId).neq("signal_type", "engagement").limit(5000),
    ]);
    if (friendsError || blocksError || signalsError) return json({ error: `Could not load affinity candidates: ${(friendsError || blocksError || signalsError)?.message}` }, 500);
    const friends = new Set((friendRows || []).map((r: any) => r.user_id === myId ? r.friend_id : r.user_id));
    const blocked = new Set((blockRows || []).map((r: any) => r.blocker_id === myId ? r.blocked_id : r.blocker_id));
    const mine = new Set(mySignals.filter((s: any) => s.signal_type !== "engagement").map((s: any) => `${s.signal_type}:${s.signal_value}`));
    const shortlistScores = new Map<string, number>();
    for (const s of signalRows || []) if (mine.has(`${s.signal_type}:${s.signal_value}`)) shortlistScores.set(s.user_id, (shortlistScores.get(s.user_id) || 0) + Number(s.strength));
    const discoveryIds = [...shortlistScores.keys()].filter((id) => !friends.has(id) && !blocked.has(id))
      .sort((a, b) => (shortlistScores.get(b)! - shortlistScores.get(a)!) || a.localeCompare(b)).slice(0, 100);
    const candidateIds = [...new Set([...friends, ...discoveryIds])].filter((id) => id !== myId && !blocked.has(id));
    if (!candidateIds.length) {
      return json({ ready: true, readiness, discoverable: true, bands: serializeBands(emptyBandPeople()), compared_now: 0, has_more: false, next_cursor: null });
    }

    const [{ data: people, error: peopleError }, { data: profiles, error: profilesError }] = await Promise.all([
      db.from("users").select("id,user_name,display_name,first_name,last_name,avatar,is_persona").in("id", candidateIds),
      db.from("dna_profiles").select("user_id,label,tagline,is_private").in("user_id", candidateIds),
    ]);
    if (peopleError || profilesError) return json({ error: `Could not load candidate profiles: ${(peopleError || profilesError)?.message}` }, 500);
    const profileByUser = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
    const counts = await trackedCounts(db, candidateIds);
    const eligible = (people || []).filter((person: any) => {
      const profile: any = profileByUser.get(person.id);
      return profile
        && counts.get(person.id)! >= 10
        && !person.is_persona
        && (friends.has(person.id) || !profile.is_private);
    });
    const ordered = eligible.sort((a: any, b: any) =>
      Number(friends.has(b.id)) - Number(friends.has(a.id))
      || (shortlistScores.get(b.id) || 0) - (shortlistScores.get(a.id) || 0)
      || String(a.id).localeCompare(String(b.id)));
    // Friends are never truncated. Chunking keeps .in() URLs safely bounded even
    // for accounts with a very large friend list.
    const comparisonRows: any[] = [];
    const freshAfter = new Date().toISOString();
    for (let start = 0; start < ordered.length; start += 50) {
      const ids = ordered.slice(start, start + 50).map((person: any) => person.id);
      const [from, to] = await Promise.all([
        db.from("dna_comparisons").select("*").eq("user_id_1", myId).in("user_id_2", ids).gte("expires_at", freshAfter),
        db.from("dna_comparisons").select("*").eq("user_id_2", myId).in("user_id_1", ids).gte("expires_at", freshAfter),
      ]);
      if (from.error || to.error) return json({ error: `Could not load cached comparisons: ${(from.error || to.error)?.message}` }, 500);
      comparisonRows.push(...(from.data || []), ...(to.data || []));
    }
    const comparisons = new Map<string, any>();
    for (const row of comparisonRows) comparisons.set(row.user_id_1 === myId ? row.user_id_2 : row.user_id_1, row);
    const missingIndexes = () => ordered.reduce((indexes: number[], person: any, index: number) => {
      if (!comparisons.has(person.id)) indexes.push(index);
      return indexes;
    }, []);
    // Load is intentionally cache-only. More scans from the supplied stable
    // position and fills only a bounded set of presently missing comparisons.
    const missing = body.action === "more"
      ? ordered.slice(requestedCursor).filter((person: any) => !comparisons.has(person.id)).slice(0, batchSize)
      : [];
    let comparedNow = 0;
    if (missing.length) {
      const signalIds = [myId, ...missing.map((p: any) => p.id)];
      const { data: freshSignals, error: freshSignalsError } = await db.from("user_dna_signals").select("user_id,signal_type,signal_value,strength").in("user_id", signalIds);
      if (freshSignalsError) return json({ error: `Could not load comparison signals: ${freshSignalsError.message}` }, 500);
      const grouped = new Map<string, any[]>(); for (const s of freshSignals || []) grouped.set(s.user_id, [...(grouped.get(s.user_id) || []), s]);
      for (const person of missing) {
        const evidence = scoreSignals(grouped.get(myId) || [], grouped.get(person.id) || []);
        const [user_id_1, user_id_2] = pair(myId, person.id);
        const row = { user_id_1, user_id_2, ...evidence, shared_titles: await sharedTitles(db, myId, person.id), insights: {}, computed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() };
        const { error: deleteError } = await db.from("dna_comparisons").delete().eq("user_id_1", user_id_2).eq("user_id_2", user_id_1);
        if (deleteError) throw deleteError;
        const { data: saved, error } = await db.from("dna_comparisons")
          .upsert(row, { onConflict: "user_id_1,user_id_2" }).select().single();
        if (error || !saved) throw new Error(`Could not save comparison: ${error?.message || "no comparison returned"}`);
        comparisons.set(person.id, saved);
        comparedNow += 1;
      }
    }
    const result = emptyBandPeople();
    for (const person of ordered) {
      const c = comparisons.get(person.id); if (!c) continue;
      const score = Number(c.match_score);
      const key = score >= 80 ? "your-people" : score >= 60 ? "same-wavelength" : score >= 40 ? "common-ground" : "wildcards";
      const profile: any = profileByUser.get(person.id);
      result[key].push({
        id: person.id,
        user_name: person.user_name,
        display_name: person.display_name,
        first_name: person.first_name,
        last_name: person.last_name,
        avatar_url: person.avatar,
        dna_label: profile?.label,
        dna_tagline: profile?.tagline,
        match_score: score,
        is_friend: friends.has(person.id),
        relationship: friends.has(person.id) ? "friend" : "discovery",
        shared_titles: c.shared_titles || [],
        shared_genres: c.shared_genres || [],
        shared_creators: c.shared_creators || [],
        differences: c.differences || {},
        insights: c.insights || {},
      });
    }
    // Re-evaluate against this request's ordering. If data changed between
    // calls, this finds the first outstanding item rather than trusting a stale
    // cursor and avoids a continuation loop.
    const nextMissing = missingIndexes()[0];
    const hasMore = nextMissing !== undefined;
    return json({
      ready: true,
      readiness,
      discoverable: true,
      bands: serializeBands(result),
      compared_now: comparedNow,
      has_more: hasMore,
      next_cursor: hasMore ? nextMissing : null,
    });
  } catch (error: any) {
    console.error("people-affinity:", error);
    return json({ error: error?.message || "Affinity request failed" }, 500);
  }
});