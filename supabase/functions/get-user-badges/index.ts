import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user badges with badge details
    const { data: userBadges, error } = await supabase
      .from("user_badges")
      .select(`
        awarded_at,
        notes,
        badges (
          id,
          slug,
          name,
          emoji,
          description,
          badge_type,
          theme_color
        )
      `)
      .eq("user_id", userId)
      .order("awarded_at", { ascending: false });

    if (error) {
      console.error("Error fetching badges:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch badges", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform the response to flatten badge data
    const badges = (userBadges || []).map((ub: any) => ({
      id: ub.badges?.id,
      slug: ub.badges?.slug,
      name: ub.badges?.name,
      emoji: ub.badges?.emoji,
      description: ub.badges?.description,
      badge_type: ub.badges?.badge_type,
      theme_color: ub.badges?.theme_color,
      awarded_at: ub.awarded_at,
      notes: ub.notes
    })).filter((b: any) => b.id);

    return new Response(
      JSON.stringify({ badges }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
