import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeAdminOrService } from "../_shared/authorization.ts";
import { mediaRecommendationPreview } from "../_shared/media-recommendation-preview.ts";

const client = () => createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", {
  auth: { persistSession: false, autoRefreshToken: false },
});
serve(mediaRecommendationPreview({
  async authorize(req) {
    const auth = await authorizeAdminOrService(req);
    if (!auth.authorized || auth.caller !== "admin") return auth;
    const { data, error } = await client().from("users").select("is_persona").eq("id", auth.userId).maybeSingle();
    if (error || !data || data.is_persona) return { authorized: false, status: 403 };
    return auth;
  },
  async read(identity) {
    const db = client();
    const openLibrary = ["openlibrary", "open_library"].includes(identity.source);
    const id = openLibrary ? identity.externalId.replace(/^\/?works\//, "") : identity.externalId;
    const { data: source, error } = await db.from("recommendation_lab_items").select("id")
      .in("external_source", openLibrary ? ["openlibrary", "open_library"] : [identity.source])
      .in("external_id", openLibrary ? [id, `/works/${id}`, `works/${id}`] : [id])
      .eq("media_type", identity.type).eq("source_verified", true).limit(2);
    if (error) throw error;
    // Ambiguous identities are unavailable, never resolved by title guessing.
    if (source?.length !== 1) return null;
    const { data: runs, error: runError } = await db.from("recommendation_lab_runs").select("results")
      .eq("experiment_key", "small-lab-1").eq("source_item_id", source[0].id)
      .eq("status", "complete").order("created_at", { ascending: false }).limit(1);
    if (runError) throw runError;
    return runs?.[0] || null;
  },
}));
