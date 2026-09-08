import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canAccessPublicProfile, canAccessFullProfile, isProfileId, loadProfileAccess, resolveProfileViewer } from "../_shared/public-profile-access.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
  "Vary": "Authorization",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!isProfileId(userId)) return json({ error: "DNA Profile not found" }, 404);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const viewerId = await resolveProfileViewer(admin, req.headers.get("Authorization"), Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const access = await loadProfileAccess(admin, userId, viewerId);
    if (!canAccessPublicProfile(access)) return json({ error: "DNA Profile not found" }, 404);

    const fullAccess = canAccessFullProfile(access);
    const columns = fullAccess
      ? "id, user_id, label, tagline, profile_text, favorite_genres, favorite_media_types, favorite_sports, flavor_notes, media_consumption_stats, core_archetype, secondary_archetypes, current_era, evidence, evolution_note, confidence_score, created_at, updated_at"
      : "id, user_id, label, tagline";
    const [profile, identity] = await Promise.all([
      admin.from("dna_profiles").select(columns).eq("user_id", userId).maybeSingle(),
      admin.from("public_user_profiles").select("user_name, display_name, first_name, last_name").eq("id", userId).maybeSingle(),
    ]);
    if (profile.error || identity.error || !profile.data || !identity.data) {
      return json({ error: "DNA Profile not found" }, 404);
    }
    const { first_name, last_name, ...user } = identity.data;
    if (!fullAccess) {
      user.display_name = first_name
        ? `${first_name}${last_name ? ` ${last_name.charAt(0)}.` : ""}`
        : user.user_name;
    }
    return json({ dna_profile: { ...profile.data, users: user }, access: fullAccess ? "full" : "preview" });
  } catch {
    // Auth and every privacy lookup fail closed without revealing whether the target exists.
    return json({ error: "DNA Profile not found" }, 404);
  }
});