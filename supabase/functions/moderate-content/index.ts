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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin status
    const { data: moderator } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("auth_id", user.id)
      .single();

    if (!moderator?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, report_id, content_type, content_id, target_user_id, reason, ban_duration_days } = await req.json();

    // Valid actions
    const validActions = ['remove', 'hide', 'warn', 'ban', 'dismiss', 'restore'];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the moderation action
    const { error: actionError } = await supabase
      .from("moderation_actions")
      .insert({
        report_id: report_id || null,
        moderator_id: moderator.id,
        content_type,
        content_id,
        action_type: action,
        reason: reason || null,
        target_user_id: target_user_id || null,
      });

    if (actionError) {
      console.error("Error logging action:", actionError);
      return new Response(JSON.stringify({ error: "Failed to log action" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle specific actions
    if (action === 'remove' || action === 'hide') {
      // Mark content as hidden/removed based on content type
      if (content_type === 'post') {
        await supabase
          .from("social_posts")
          .update({ is_hidden: true })
          .eq("id", content_id);
      } else if (content_type === 'comment') {
        await supabase
          .from("comments")
          .update({ is_hidden: true })
          .eq("id", content_id);
      } else if (content_type === 'hot_take') {
        await supabase
          .from("hot_takes")
          .update({ is_hidden: true })
          .eq("id", content_id);
      }
    }

    if (action === 'restore') {
      // Restore hidden content
      if (content_type === 'post') {
        await supabase
          .from("social_posts")
          .update({ is_hidden: false })
          .eq("id", content_id);
      } else if (content_type === 'comment') {
        await supabase
          .from("comments")
          .update({ is_hidden: false })
          .eq("id", content_id);
      } else if (content_type === 'hot_take') {
        await supabase
          .from("hot_takes")
          .update({ is_hidden: false })
          .eq("id", content_id);
      }
    }

    if (action === 'warn' && target_user_id) {
      // Increment warning count
      await supabase
        .from("user_moderation_status")
        .upsert({
          user_id: target_user_id,
          warning_count: 1,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
      
      // Increment warning count if exists
      await supabase.rpc('increment_warning_count', { p_user_id: target_user_id });
    }

    if (action === 'ban' && target_user_id) {
      const bannedUntil = ban_duration_days 
        ? new Date(Date.now() + ban_duration_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await supabase
        .from("user_moderation_status")
        .upsert({
          user_id: target_user_id,
          is_banned: true,
          ban_reason: reason || 'Violation of community guidelines',
          banned_until: bannedUntil,
          banned_at: new Date().toISOString(),
          banned_by: moderator.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
    }

    // Update report status if report_id provided
    if (report_id) {
      const newStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
      await supabase
        .from("content_reports")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", report_id);
    }

    return new Response(JSON.stringify({ success: true, action }), {
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
