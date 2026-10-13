import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeAdminOrService } from "../_shared/authorization.ts";
import { researchHandler } from "../_shared/content-research-handler.ts";
import { createResearchServices } from "../_shared/content-research-providers.ts";

serve(researchHandler({
  async authorize(req) {
    const auth = await authorizeAdminOrService(req);
    if (!auth.authorized || auth.caller !== "admin") return auth;
    const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data, error } = await admin.from("users").select("is_persona").eq("id", auth.userId).maybeSingle();
    if (error || !data || data.is_persona) return { authorized: false, status: 403 };
    return auth;
  },
  async limit(userId, action) {
    const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data, error } = await admin.rpc("consume_admin_content_research_limit", { p_admin_id: userId, p_action: action });
    if (error) throw new Error("Research request limiter unavailable");
    return data === true;
  },
  services: req => createResearchServices({
    baseUrl: Deno.env.get("SUPABASE_URL") || "",
    authorization: req.headers.get("Authorization") || "",
    openaiKey: Deno.env.get("OPENAI_API_KEY"),
    tmdbKey: Deno.env.get("TMDB_API_KEY"),
    signal: req.signal,
  }),
}));
