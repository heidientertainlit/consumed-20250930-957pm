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
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const errors: string[] = [];

    const userIdTables = [
      "social_post_likes",
      "social_post_comments",
      "social_comment_likes",
      "social_comment_votes",
      "social_posts",
      "post_votes",
      "prediction_likes",
      "prediction_comments",
      "prediction_comment_likes",
      "prediction_comment_votes",
      "predictions",
      "user_predictions",
      "media_ratings",
      "ratings",
      "reviews",
      "user_media",
      "user_media_items",
      "media_history_log",
      "media_statuses",
      "list_items",
      "list_collaborators",
      "lists",
      "user_lists",
      "rank_item_votes",
      "rank_comments",
      "rank_items",
      "ranks",
      "login_streaks",
      "dna_profiles",
      "dna_moment_responses",
      "dna_comparisons",
      "entertainment_dna",
      "edna_responses",
      "user_dna_levels",
      "user_dna_signals",
      "notifications",
      "activity_logs",
      "user_activity",
      "user_last_activity",
      "points_log",
      "user_points",
      "user_prediction_stats",
      "user_highlights",
      "user_badges",
      "user_creator_stats",
      "user_flags",
      "beta_feedback",
      "poll_responses",
      "pool_answers",
      "pool_members",
      "hot_take_votes",
      "hot_take_passes",
      "daily_challenge_responses",
      "daily_runs",
      "seen_it_completions",
      "seen_it_responses",
      "friend_cast_responses",
      "friend_casts",
      "friend_invitations",
      "friends_trivia",
      "followed_creators",
      "awards_picks",
      "awards_ballot_completions",
      "bets",
      "cached_recommendations",
      "rec_requests",
      "media_goals",
      "strand_likes",
      "strand_comments",
      "strand_media",
      "strands",
      "trivia_answers",
      "trivia_results",
      "trivia_user_points",
      "celebrity_dna",
      "profiles",
    ];

    for (const table of userIdTables) {
      try {
        const { error } = await adminClient.from(table).delete().eq("user_id", userId);
        if (error) {
          console.log(`Table ${table} error:`, error.message);
          errors.push(`${table}: ${error.message}`);
        }
      } catch (e) {
        console.log(`Skipping ${table}:`, e.message);
      }
    }

    // Friendships - user can be on either side
    try {
      await adminClient.from("friendships").delete().eq("user_id", userId);
      await adminClient.from("friendships").delete().eq("friend_id", userId);
    } catch (e) {
      console.log("Skipping friendships:", e.message);
    }

    // Delete from profiles table (might use 'id' instead of 'user_id')
    try {
      await adminClient.from("profiles").delete().eq("id", userId);
    } catch (e) {
      console.log("Skipping profiles by id:", e.message);
    }

    // Delete the auth user last
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete auth account", details: errors }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, tablesProcessed: userIdTables.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
