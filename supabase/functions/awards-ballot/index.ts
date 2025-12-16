import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const eventSlug = url.searchParams.get("event");
    const userId = url.searchParams.get("user_id");

    if (!eventSlug || !userId) {
      return new Response(
        JSON.stringify({ error: "event and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the event
    const { data: event, error: eventError } = await supabaseClient
      .from("awards_events")
      .select("*")
      .eq("slug", eventSlug)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info
    const { data: user } = await supabaseClient
      .from("users")
      .select("id, display_name, username, avatar_url")
      .eq("id", userId)
      .single();

    // Fetch categories
    const { data: categories } = await supabaseClient
      .from("awards_categories")
      .select(`
        id,
        name,
        short_name,
        winner_nominee_id,
        nominees:awards_nominees(id, name, title, poster_url)
      `)
      .eq("event_id", event.id)
      .order("display_order", { ascending: true });

    // Get user's picks for this event
    const categoryIds = categories?.map(c => c.id) || [];
    const { data: picks } = await supabaseClient
      .from("awards_picks")
      .select("category_id, nominee_id, is_correct, points_earned")
      .eq("user_id", userId)
      .in("category_id", categoryIds);

    // Build ballot with picks mapped to categories
    const pickMap: Record<string, any> = {};
    picks?.forEach(p => {
      pickMap[p.category_id] = p;
    });

    const ballot = categories?.map(cat => {
      const pick = pickMap[cat.id];
      const pickedNominee = pick 
        ? cat.nominees?.find((n: any) => n.id === pick.nominee_id)
        : null;
      const winnerNominee = cat.winner_nominee_id
        ? cat.nominees?.find((n: any) => n.id === cat.winner_nominee_id)
        : null;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryShortName: cat.short_name,
        pick: pickedNominee ? {
          id: pickedNominee.id,
          name: pickedNominee.name,
          title: pickedNominee.title,
          posterUrl: pickedNominee.poster_url,
          isCorrect: pick?.is_correct,
          pointsEarned: pick?.points_earned
        } : null,
        winner: winnerNominee ? {
          id: winnerNominee.id,
          name: winnerNominee.name,
          title: winnerNominee.title,
          posterUrl: winnerNominee.poster_url
        } : null
      };
    }) || [];

    // Calculate stats
    const totalCategories = ballot.length;
    const picksMade = ballot.filter(b => b.pick).length;
    const correctPicks = ballot.filter(b => b.pick?.isCorrect === true).length;
    const totalPoints = ballot.reduce((sum, b) => sum + (b.pick?.pointsEarned || 0), 0);

    return new Response(
      JSON.stringify({
        event: {
          id: event.id,
          name: event.name,
          year: event.year,
          status: event.status
        },
        user: user ? {
          id: user.id,
          displayName: user.display_name,
          username: user.username,
          avatarUrl: user.avatar_url
        } : null,
        ballot,
        stats: {
          totalCategories,
          picksMade,
          correctPicks,
          totalPoints
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in awards-ballot function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
