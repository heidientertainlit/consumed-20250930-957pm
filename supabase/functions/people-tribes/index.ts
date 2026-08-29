import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const ALGORITHM_VERSION = "tribe-weighted-groups-v2-calibrated";
const normalize = (value: unknown) => String(value || "").trim().toLowerCase();
const mediaKey = (item: any) => {
  const source = normalize(item.media_external_source || item.external_source);
  const id = normalize(item.media_external_id || item.external_id);
  if (source && id) return `${source}:${id}`;
  const type = normalize(item.media_type || item.type);
  const title = normalize(item.media_title || item.title).replace(/[^a-z0-9]+/g, "");
  return title ? `${type}:${title}` : "";
};
const mediaShape = (item: any, artwork = "") => ({
  title: item.media_title || item.title || "",
  media_type: item.media_type || item.type || "",
  creator: item.media_creator || item.creator || "",
  image_url: item.image_url || item.poster_url || artwork || "",
  external_id: item.media_external_id || item.external_id || "",
  external_source: item.media_external_source || item.external_source || "",
});
const safeName = (person: any) => {
  const first = String(person.first_name || "").trim();
  const last = String(person.last_name || "").trim();
  return first ? `${first}${last ? ` ${last[0].toUpperCase()}.` : ""}` : person.display_name || person.user_name || "Consumed member";
};

async function buildTribePayoffs(db: any, viewerId: string, tribeIds: string[], definitions: any[]) {
  const empty = new Map(tribeIds.map((id) => [id, { people: [], loved_media: [], trending_media: [], recent_takes: [] }]));
  if (!tribeIds.length) return empty;

  const { data: candidateRows, error: candidatesError } = await db.rpc("get_people_affinity_candidates", {
    p_user_id: viewerId,
    p_after_friend: null,
    p_after_id: null,
    p_limit: 51,
  });
  if (candidatesError) throw new Error(`Could not load Tribe people: ${candidatesError.message}`);
  const candidateIds = [...new Set((candidateRows || []).map((row: any) => row.id))].slice(0, 50);
  if (!candidateIds.length) return empty;

  const { data: candidateSignals, error: signalsError } = await db.from("user_dna_signals")
    .select("user_id,signal_type,signal_value,strength")
    .in("user_id", candidateIds);
  if (signalsError) throw new Error(`Could not score Tribe people: ${signalsError.message}`);
  const signalsByUser = new Map<string, any[]>();
  for (const signal of candidateSignals || []) signalsByUser.set(signal.user_id, [...(signalsByUser.get(signal.user_id) || []), signal]);
  const users = new Map((candidateRows || []).map((person: any) => [person.id, person]));
  const recommendationRows: any[] = [];
  for (const person of candidateRows || []) {
    for (const tribeId of tribeIds) {
      const score = scoreTribe(signalsByUser.get(person.id) || [], definitions.filter((definition: any) => definition.tribe_id === tribeId));
      if (score.recommended) recommendationRows.push({ tribe_id: tribeId, user_id: person.id, fit_score: score.fit_score });
    }
  }
  recommendationRows.sort((a, b) => b.fit_score - a.fit_score || String(a.user_id).localeCompare(String(b.user_id)));

  const rowsByTribe = new Map<string, any[]>();
  for (const row of recommendationRows || []) {
    if (!users.has(row.user_id)) continue;
    const rows = rowsByTribe.get(row.tribe_id) || [];
    if (rows.length < 20) rows.push(row);
    rowsByTribe.set(row.tribe_id, rows);
  }
  const boundedIds = [...new Set([...rowsByTribe.values()].flatMap((rows) => rows.map((row) => row.user_id)))].slice(0, 100);

  const [listResult, ratingsResult, postsResult, viewerListResult, viewerRatingsResult] = await Promise.all([
    db.from("list_items").select("*").in("user_id", boundedIds).limit(3000),
    db.from("media_ratings").select("*").in("user_id", boundedIds).limit(3000),
    db.from("social_posts").select("*").in("user_id", boundedIds).order("created_at", { ascending: false }).limit(500),
    db.from("list_items").select("*").eq("user_id", viewerId).limit(2000),
    db.from("media_ratings").select("*").eq("user_id", viewerId).limit(2000),
  ]);
  const contentError = listResult.error || ratingsResult.error || postsResult.error || viewerListResult.error || viewerRatingsResult.error;
  if (contentError) throw new Error(`Could not load Tribe activity: ${contentError.message}`);

  const consumed = new Set([...(viewerListResult.data || []), ...(viewerRatingsResult.data || [])].map(mediaKey).filter(Boolean));
  const artworkByKey = new Map<string, string>();
  for (const item of listResult.data || []) {
    const key = mediaKey(item);
    if (key && item.image_url && !artworkByKey.has(key)) artworkByKey.set(key, item.image_url);
  }
  const listsByUser = new Map<string, any[]>();
  for (const item of listResult.data || []) listsByUser.set(item.user_id, [...(listsByUser.get(item.user_id) || []), item]);
  const ratingsByUser = new Map<string, any[]>();
  for (const item of ratingsResult.data || []) ratingsByUser.set(item.user_id, [...(ratingsByUser.get(item.user_id) || []), item]);
  const postsByUser = new Map<string, any[]>();
  for (const item of postsResult.data || []) postsByUser.set(item.user_id, [...(postsByUser.get(item.user_id) || []), item]);
  const recentAfter = Date.now() - 30 * 86400000;

  for (const tribeId of tribeIds) {
    const groupRows = rowsByTribe.get(tribeId) || [];
    const groupIds = groupRows.map((row) => row.user_id);
    const people = groupRows.slice(0, 8).map((row) => {
      const person = users.get(row.user_id);
      return {
        id: person.id,
        user_name: person.user_name,
        display_name: safeName(person),
        first_name: person.first_name,
        last_name: person.last_name,
        avatar_url: person.avatar,
        match_score: Number(row.fit_score || 0),
      };
    });

    const ratingAggregates = new Map<string, any>();
    for (const id of groupIds) {
      for (const rating of ratingsByUser.get(id) || []) {
        const key = mediaKey(rating);
        if (!key || consumed.has(key) || !rating.media_title) continue;
        const aggregate = ratingAggregates.get(key) || { item: rating, ratings: [], users: new Set<string>() };
        aggregate.ratings.push(Number(rating.rating || 0));
        aggregate.users.add(id);
        ratingAggregates.set(key, aggregate);
      }
    }
    const loved = [...ratingAggregates.entries()].map(([key, aggregate]) => {
      const positive = aggregate.ratings.filter((rating: number) => rating >= 4).length;
      const average = aggregate.ratings.reduce((sum: number, rating: number) => sum + rating, 0) / aggregate.ratings.length;
      return {
        ...mediaShape(aggregate.item, artworkByKey.get(key)),
        avg_rating: Number(average.toFixed(1)),
        like_percent: Math.round((positive / aggregate.ratings.length) * 100),
        people_count: aggregate.users.size,
      };
    }).filter((item) => item.avg_rating >= 4)
      .sort((a, b) => b.people_count - a.people_count || b.like_percent - a.like_percent || b.avg_rating - a.avg_rating)
      .slice(0, 6);

    const trendAggregates = new Map<string, any>();
    for (const id of groupIds) {
      const events = [
        ...(listsByUser.get(id) || []).map((item) => ({ item, date: item.added_at || item.date_added || item.created_at })),
        ...(postsByUser.get(id) || []).map((item) => ({ item, date: item.created_at })),
      ];
      for (const event of events) {
        const timestamp = Date.parse(event.date || "");
        const key = mediaKey(event.item);
        if (!key || !timestamp || timestamp < recentAfter) continue;
        const aggregate = trendAggregates.get(key) || { item: event.item, events: 0, users: new Set<string>(), newest: 0 };
        aggregate.events += 1;
        aggregate.users.add(id);
        aggregate.newest = Math.max(aggregate.newest, timestamp);
        trendAggregates.set(key, aggregate);
      }
    }
    const trending = [...trendAggregates.entries()].map(([key, aggregate]) => ({
      ...mediaShape(aggregate.item, artworkByKey.get(key)),
      activity_count: aggregate.events,
      people_count: aggregate.users.size,
      latest_at: new Date(aggregate.newest).toISOString(),
    })).filter((item) => item.title)
      .sort((a, b) => b.people_count - a.people_count || b.activity_count - a.activity_count || Date.parse(b.latest_at) - Date.parse(a.latest_at))
      .slice(0, 6);

    const takes = groupIds.flatMap((id) => (postsByUser.get(id) || []).map((post) => ({ post, person: users.get(id) })))
      .filter(({ post }) => String(post.content || "").trim() && post.visibility !== "private")
      .sort((a, b) => Date.parse(b.post.created_at || "") - Date.parse(a.post.created_at || ""))
      .slice(0, 3)
      .map(({ post, person }) => ({
        id: post.id,
        content: post.content,
        post_type: post.post_type,
        created_at: post.created_at,
        likes_count: Number(post.likes_count || 0),
        comments_count: Number(post.comments_count || 0),
        media: mediaShape(post, artworkByKey.get(mediaKey(post))),
        author: { id: person.id, display_name: safeName(person), avatar_url: person.avatar || "" },
      }));

    empty.set(tribeId, { people, loved_media: loved, trending_media: trending, recent_takes: takes });
  }
  return empty;
}

function scoreTribe(signals: any[], definitions: any[]) {
  const userSignals = new Map(signals
    .filter((signal) => signal.signal_type !== "engagement")
    .map((signal) => [`${signal.signal_type}:${String(signal.signal_value).toLowerCase().trim()}`, Number(signal.strength) || 0]));
  const evidence: any[] = [];
  const matchedGroups = new Set<string>();
  let contribution = 0;
  let totalWeight = 0;
  for (const definition of definitions) {
    const weight = Number(definition.weight) || 0;
    const strength = userSignals.get(`${definition.signal_type}:${String(definition.signal_value).toLowerCase().trim()}`) || 0;
    totalWeight += weight;
    if (strength >= Number(definition.min_strength || 0)) {
      const amount = weight * strength;
      contribution += amount;
      matchedGroups.add(definition.signal_group);
      evidence.push({
        group: definition.signal_group,
        type: definition.signal_type,
        value: definition.signal_value,
        label: definition.display_label,
        strength,
        contribution: Number(amount.toFixed(4)),
      });
    }
  }
  const raw = totalWeight ? contribution / totalWeight : 0;
  // Reward breadth, but never manufacture a recommendation from one dimension.
  const breadth = Math.min(1, matchedGroups.size / 3);
  const baseScore = Math.max(0, Math.min(100, Math.round((raw * 0.72 + breadth * 0.28) * 100)));
  const recommended = matchedGroups.size >= 2 && baseScore >= 24;
  // The base score is intentionally strict because it measures coverage across
  // every defining signal. Once a Tribe clears the recommendation threshold,
  // calibrate the user-facing percentage into the intuitive 70–100% range.
  const fitScore = recommended
    ? Math.round(70 + ((baseScore - 24) / 76) * 30)
    : baseScore;
  return {
    fit_score: fitScore,
    matched_groups: [...matchedGroups],
    evidence: evidence.sort((a, b) => b.contribution - a.contribution).slice(0, 6),
    recommended,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const db = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "load";
    if (!["load", "join", "leave"].includes(action)) return json({ error: "Invalid action" }, 400);

    const [{ data: profile, error: profileError }, { data: eligibility, error: eligibilityError }] = await Promise.all([
      db.from("dna_profiles").select("id").eq("user_id", user.id).maybeSingle(),
      db.from("people_affinity_eligibility").select("tracked_items").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profileError) return json({ error: `Could not load DNA readiness: ${profileError.message}` }, 500);
    if (eligibilityError) return json({ error: `Could not load tracking readiness: ${eligibilityError.message}` }, 500);
    const count = Number(eligibility?.tracked_items || 0);
    const readiness = {
      has_dna_profile: !!profile,
      tracked_items: count,
      required_tracked_items: 10,
      items_needed: Math.max(0, 10 - count),
      ready: count >= 10,
    };

    if (action === "join" || action === "leave") {
      if (!readiness.ready) return json({ error: "Track 10 items before joining a Tribe.", readiness }, 403);
      const slug = String(body?.slug || "").trim();
      if (!slug) return json({ error: "slug is required" }, 400);
      const { data: tribe, error: tribeError } = await db.from("people_tribes").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
      if (tribeError || !tribe) return json({ error: "Tribe not found" }, 404);
      if (action === "join") {
        const { data: recommendation } = await db.from("people_tribe_recommendations")
          .select("fit_score").eq("tribe_id", tribe.id).eq("user_id", user.id).maybeSingle();
        const { error } = await db.from("people_tribe_members").upsert({
          tribe_id: tribe.id,
          user_id: user.id,
          status: "active",
          membership_source: body?.source === "invite" ? "invite" : "user_join",
          join_score: recommendation?.fit_score ?? null,
          joined_at: new Date().toISOString(),
          left_at: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tribe_id,user_id" });
        if (error) throw new Error(`Could not join Tribe: ${error.message}`);
      } else {
        const { error } = await db.from("people_tribe_members").update({
          status: "left",
          left_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("tribe_id", tribe.id).eq("user_id", user.id);
        if (error) throw new Error(`Could not leave Tribe: ${error.message}`);
      }
    }

    const [{ data: tribes, error: tribesError }, { data: definitions, error: definitionsError }, { data: media, error: mediaError }, { data: signals, error: signalsError }] = await Promise.all([
      db.from("people_tribes").select("*").eq("is_active", true).order("sort_order"),
      db.from("people_tribe_signals").select("*").order("sort_order"),
      db.from("people_tribe_media").select("*").order("sort_order"),
      db.from("user_dna_signals").select("signal_type,signal_value,strength").eq("user_id", user.id),
    ]);
    const loadError = tribesError || definitionsError || mediaError || signalsError;
    if (loadError) throw new Error(`Could not load Tribes: ${loadError.message}`);

    const scores = new Map<string, any>();
    if (readiness.ready) {
      for (const tribe of tribes || []) {
        const score = scoreTribe(signals || [], (definitions || []).filter((definition: any) => definition.tribe_id === tribe.id));
        scores.set(tribe.id, score);
        const { error } = await db.from("people_tribe_recommendations").upsert({
          tribe_id: tribe.id,
          user_id: user.id,
          fit_score: score.fit_score,
          matched_groups: score.matched_groups,
          evidence: score.evidence,
          algorithm_version: ALGORITHM_VERSION,
          computed_at: new Date().toISOString(),
        }, { onConflict: "tribe_id,user_id" });
        if (error) throw new Error(`Could not save Tribe recommendation: ${error.message}`);
      }
    }

    const tribeIds = (tribes || []).map((tribe: any) => tribe.id);
    const [{ data: ownMembershipRows, error: membershipError }, { data: memberSummaries, error: summariesError }] = await Promise.all([
      tribeIds.length
        ? db.from("people_tribe_members").select("tribe_id").in("tribe_id", tribeIds).eq("user_id", user.id).eq("status", "active")
        : Promise.resolve({ data: [], error: null }),
      tribeIds.length
        ? db.rpc("get_people_tribe_member_previews", { p_user_id: user.id, p_tribe_ids: tribeIds })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (membershipError || summariesError) throw new Error(`Could not load Tribe members: ${(membershipError || summariesError).message}`);
    const ownMemberships = new Set((ownMembershipRows || []).map((row: any) => row.tribe_id));
    const summariesByTribe = new Map((memberSummaries || []).map((summary: any) => [summary.tribe_id, summary]));
    const payoffsByTribe = readiness.ready ? await buildTribePayoffs(db, user.id, tribeIds, definitions || []) : new Map();

    const responseTribes = (tribes || []).map((tribe: any) => {
      const score = scores.get(tribe.id) || { fit_score: 0, matched_groups: [], evidence: [], recommended: false };
      const summary: any = summariesByTribe.get(tribe.id);
      const payoff: any = payoffsByTribe.get(tribe.id) || { people: [], loved_media: [], trending_media: [], recent_takes: [] };
      const isMember = ownMemberships.has(tribe.id);
      return {
        id: tribe.id,
        slug: tribe.slug,
        name: tribe.name,
        description: tribe.description,
        identity_statement: tribe.identity_statement,
        accent_color: tribe.accent_color,
        accent_color_2: tribe.accent_color_2,
        fit_score: score.fit_score,
        matched_groups: score.matched_groups,
        evidence: score.evidence,
        recommended: score.recommended,
        is_member: isMember,
        member_count: Number(summary?.member_count || 0),
        members: Array.isArray(summary?.members) ? summary.members : [],
        people: payoff.people,
        loved_media: payoff.loved_media,
        trending_media: payoff.trending_media,
        recent_takes: payoff.recent_takes,
        media: (media || []).filter((item: any) => item.tribe_id === tribe.id).map((item: any) => ({
          id: item.id,
          title: item.title,
          media_type: item.media_type,
          creator: item.creator,
          image_url: item.image_url,
          external_id: item.external_id,
          external_source: item.external_source,
          editorial_reason: item.editorial_reason,
        })),
      };
    }).sort((a: any, b: any) =>
      Number(b.is_member) - Number(a.is_member)
      || Number(b.recommended) - Number(a.recommended)
      || b.fit_score - a.fit_score);

    return json({ readiness, tribes: responseTribes });
  } catch (error: any) {
    console.error("people-tribes:", error);
    return json({ error: error?.message || "Tribes request failed" }, 500);
  }
});