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

    const responseTribes = (tribes || []).map((tribe: any) => {
      const score = scores.get(tribe.id) || { fit_score: 0, matched_groups: [], evidence: [], recommended: false };
      const summary: any = summariesByTribe.get(tribe.id);
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