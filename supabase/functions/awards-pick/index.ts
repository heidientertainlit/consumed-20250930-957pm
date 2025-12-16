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

    return new Response(
      JSON.stringify({ 
        success: true, 
        pick: {
          id: pick.id,
          categoryId: pick.category_id,
          nomineeId: pick.nominee_id
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
