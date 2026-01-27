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

    const { user_id, category_id, nominee_id } = await req.json();

    if (!user_id || !category_id || !nominee_id) {
      return new Response(
        JSON.stringify({ error: "user_id, category_id, and nominee_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the category exists and event is still open
    const { data: category, error: catError } = await supabaseClient
      .from("awards_categories")
      .select(`
        id,
        event:awards_events(status, deadline)
      `)
      .eq("id", category_id)
      .single();

    if (catError || !category) {
      return new Response(
        JSON.stringify({ error: "Category not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = category.event as any;
    if (event?.status !== "open") {
      return new Response(
        JSON.stringify({ error: "Predictions are locked for this event" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check deadline
    if (event?.deadline && new Date(event.deadline) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Prediction deadline has passed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify nominee exists and belongs to this category
    const { data: nominee, error: nomError } = await supabaseClient
      .from("awards_nominees")
      .select("id")
      .eq("id", nominee_id)
      .eq("category_id", category_id)
      .single();

    if (nomError || !nominee) {
      return new Response(
        JSON.stringify({ error: "Nominee not found in this category" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has a pick for this category
    const { data: existingPick } = await supabaseClient
      .from("awards_picks")
      .select("id")
      .eq("user_id", user_id)
      .eq("category_id", category_id)
      .single();

    const isNewPick = !existingPick;

    // Upsert the pick (insert or update if exists)
    const { data: pick, error: pickError } = await supabaseClient
      .from("awards_picks")
      .upsert({
        user_id,
        category_id,
        nominee_id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id,category_id"
      })
      .select()
      .single();

    if (pickError) {
      console.error("Error saving pick:", pickError);
      return new Response(
        JSON.stringify({ error: "Failed to save pick" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Award 1 point for new predictions only (not changes) - atomic update via RPC
    let pointsAwarded = 0;
    if (isNewPick) {
      pointsAwarded = 1;
      
      // Use raw SQL for atomic increment to avoid race conditions
      const { error: pointsError } = await supabaseClient.rpc('add_user_points', { 
        target_user_id: user_id, 
        points_to_add: 1 
      });
      
      // If RPC doesn't exist, fall back to direct update (less safe but works)
      if (pointsError?.message?.includes('function') || pointsError?.message?.includes('does not exist')) {
        const { data: userData } = await supabaseClient
          .from("users")
          .select("points")
          .eq("id", user_id)
          .single();
        
        await supabaseClient
          .from("users")
          .update({ points: (userData?.points || 0) + 1 })
          .eq("id", user_id);
      }
    }

    // Get the event ID from the category
    const { data: categoryWithEvent } = await supabaseClient
      .from("awards_categories")
      .select("event_id")
      .eq("id", category_id)
      .single();

    const eventId = categoryWithEvent?.event_id;

    // Check if user has completed their full ballot (for tiebreaker timestamp)
    const { data: allCategories } = await supabaseClient
      .from("awards_categories")
      .select("id")
      .eq("event_id", eventId);

    const categoryIds = allCategories?.map(c => c.id) || [];

    const { data: userPicks } = await supabaseClient
      .from("awards_picks")
      .select("category_id")
      .eq("user_id", user_id)
      .in("category_id", categoryIds);

    const totalCategories = allCategories?.length || 0;
    const userPickCount = userPicks?.length || 0;
    const ballotComplete = userPickCount >= totalCategories && totalCategories > 0;

    // Record ballot completion timestamp for tiebreaker (first time only)
    if (ballotComplete && eventId) {
      const { data: existingCompletion } = await supabaseClient
        .from("awards_ballot_completions")
        .select("id")
        .eq("user_id", user_id)
        .eq("event_id", eventId)
        .single();

      if (!existingCompletion) {
        await supabaseClient
          .from("awards_ballot_completions")
          .insert({
            user_id,
            event_id: eventId,
            completed_at: new Date().toISOString()
          });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pick: {
          id: pick.id,
          categoryId: pick.category_id,
          nomineeId: pick.nominee_id
        },
        pointsAwarded,
        ballotComplete,
        progress: {
          picked: userPickCount,
          total: totalCategories
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in awards-pick function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
