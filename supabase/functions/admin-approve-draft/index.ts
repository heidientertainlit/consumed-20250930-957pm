import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { draft_id, scheduled_for, content_override, rating_override } = await req.json();

    if (!draft_id || !scheduled_for) {
      return new Response(JSON.stringify({ error: "draft_id and scheduled_for are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the draft
    const { data: draft, error: fetchError } = await supabase
      .from("persona_post_drafts")
      .select("*")
      .eq("id", draft_id)
      .single();

    if (fetchError || !draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalContent = content_override ?? draft.content;
    const finalRating = rating_override !== undefined ? rating_override : draft.rating;

    // Save edits back to draft if changed
    if (content_override !== undefined || rating_override !== undefined) {
      await supabase
        .from("persona_post_drafts")
        .update({ content: finalContent, rating: finalRating })
        .eq("id", draft_id);
    }

    // Insert into scheduled_persona_posts (service role bypasses RLS)
    const { error: scheduleError } = await supabase
      .from("scheduled_persona_posts")
      .insert({
        persona_user_id: draft.persona_user_id,
        post_type: draft.post_type,
        content: finalContent,
        rating: finalRating,
        media_title: draft.media_title,
        media_type: draft.media_type,
        media_creator: draft.media_creator,
        contains_spoilers: false,
        scheduled_for,
        posted: false,
      });

    if (scheduleError) {
      return new Response(JSON.stringify({ error: scheduleError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update draft status to approved
    const { error: updateError } = await supabase
      .from("persona_post_drafts")
      .update({
        status: "approved",
        scheduled_for,
        approved_at: new Date().toISOString(),
      })
      .eq("id", draft_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
