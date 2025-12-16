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
    const slug = url.searchParams.get("slug");
    const userId = url.searchParams.get("user_id");

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Event slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the event
    const { data: event, error: eventError } = await supabaseClient
      .from("awards_events")
      .select("*")
      .eq("slug", slug)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch categories with nominees
    const { data: categories, error: catError } = await supabaseClient
      .from("awards_categories")
      .select(`
        *,
        nominees:awards_nominees(*)
      `)
      .eq("event_id", event.id)
      .order("display_order", { ascending: true });

    if (catError) {
      console.error("Error fetching categories:", catError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch categories" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sort nominees within each category
    const categoriesWithSortedNominees = categories?.map(cat => ({
      ...cat,
      nominees: cat.nominees?.sort((a: any, b: any) => a.display_order - b.display_order) || []
    })) || [];

    // Fetch user picks if userId provided
    let userPicks: Record<string, string> = {};
    if (userId) {
      const categoryIds = categoriesWithSortedNominees.map(c => c.id);
      const { data: picks } = await supabaseClient
        .from("awards_picks")
        .select("category_id, nominee_id")
        .eq("user_id", userId)
        .in("category_id", categoryIds);

      if (picks) {
        picks.forEach(p => {
          userPicks[p.category_id] = p.nominee_id;
        });
      }
    }

    // Get aggregate insights for each category
    const insights: Record<string, any> = {};
    for (const cat of categoriesWithSortedNominees) {
      const { data: pickCounts } = await supabaseClient
        .from("awards_picks")
        .select("nominee_id")
        .eq("category_id", cat.id);

      if (pickCounts && pickCounts.length > 0) {
        const counts: Record<string, number> = {};
        pickCounts.forEach(p => {
          counts[p.nominee_id] = (counts[p.nominee_id] || 0) + 1;
        });

        const totalPicks = pickCounts.length;
        let mostPickedId = "";
        let mostPickedCount = 0;
        
        Object.entries(counts).forEach(([id, count]) => {
          if (count > mostPickedCount) {
            mostPickedId = id;
            mostPickedCount = count;
          }
        });

        const mostPickedNominee = cat.nominees?.find((n: any) => n.id === mostPickedId);
        
        insights[cat.id] = {
          totalPicks,
          mostPicked: mostPickedNominee?.name || "Unknown",
          percentage: Math.round((mostPickedCount / totalPicks) * 100),
          trending: Math.floor(Math.random() * 15) + 1, // TODO: Calculate real trending data
          friendsPicked: 0 // TODO: Calculate based on user's friends
        };
      }
    }

    // Build response
    const response = {
      id: event.id,
      slug: event.slug,
      name: event.name,
      year: event.year,
      ceremonyDate: event.ceremony_date,
      deadline: event.deadline,
      status: event.status,
      bannerUrl: event.banner_url,
      description: event.description,
      pointsPerCorrect: event.points_per_correct,
      categories: categoriesWithSortedNominees.map(cat => ({
        id: cat.id,
        name: cat.name,
        shortName: cat.short_name,
        winner: cat.winner_nominee_id,
        insight: insights[cat.id] || null,
        nominees: cat.nominees?.map((nom: any) => ({
          id: nom.id,
          name: nom.name,
          title: nom.title,
          subtitle: nom.subtitle,
          posterUrl: nom.poster_url,
          tmdbId: nom.tmdb_id,
          tmdbPopularity: nom.tmdb_popularity || Math.floor(Math.random() * 100) + 50
        })) || []
      })),
      userPicks
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in awards-event function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
