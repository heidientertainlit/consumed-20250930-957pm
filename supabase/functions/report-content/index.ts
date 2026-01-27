import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's profile ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { content_type, content_id, reason, description } = await req.json();

    // Validate required fields
    if (!content_type || !content_id || !reason) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valid content types and reasons
    const validContentTypes = ['post', 'comment', 'hot_take', 'list', 'review'];
    const validReasons = ['spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'spoiler', 'other'];

    if (!validContentTypes.includes(content_type)) {
      return new Response(JSON.stringify({ error: "Invalid content type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!validReasons.includes(reason)) {
      return new Response(JSON.stringify({ error: "Invalid reason" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already reported this content
    const { data: existingReport } = await supabase
      .from("content_reports")
      .select("id")
      .eq("reporter_id", profile.id)
      .eq("content_type", content_type)
      .eq("content_id", content_id)
      .single();

    if (existingReport) {
      return new Response(JSON.stringify({ error: "You have already reported this content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the report
    const { data: report, error: insertError } = await supabase
      .from("content_reports")
      .insert({
        reporter_id: profile.id,
        content_type,
        content_id,
        reason,
        description: description || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating report:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create report" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
