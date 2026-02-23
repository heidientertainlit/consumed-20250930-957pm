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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    console.log("Service role key present:", !!serviceRoleKey);
    console.log("Anon key present:", !!anonKey);

    // Authenticate the user with the anon client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid user", details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.log("Deleting account for user:", userId, user.email);

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Delete in order: children first, then parents
    // Order matters due to foreign key constraints
    const deleteSteps = [
      // Likes/votes/comments on posts (children of posts)
      "social_comment_likes",
      "social_comment_votes",
      "social_post_likes",
      "social_post_comments",
      "post_votes",
      // Prediction related (children first)
      "prediction_comment_likes",
      "prediction_comment_votes",
      "prediction_comments",
      "prediction_likes",
      "predictions",
      "user_predictions",
      "user_prediction_stats",
      // Posts
      "social_posts",
      // Media related
      "media_ratings",
      "ratings",
      "reviews",
      "media_statuses",
      "media_history_log",
      "user_media_items",
      "user_media",
      // Lists
      "list_collaborators",
      "list_items",
      "user_lists",
      "lists",
      // Ranks
      "rank_item_votes",
      "rank_comments",
      "rank_items",
      "ranks",
      // DNA
      "dna_comparisons",
      "dna_moment_responses",
      "dna_profiles",
      "entertainment_dna",
      "edna_responses",
      "user_dna_levels",
      "user_dna_signals",
      "celebrity_dna",
      // Social
      "friend_cast_responses",
      "friend_casts",
      "friend_invitations",
      "friends_trivia",
      "followed_creators",
      "hot_take_votes",
      "hot_take_passes",
      // Polls/pools
      "poll_responses",
      "pool_answers",
      "pool_members",
      // Awards
      "awards_picks",
      "awards_ballot_completions",
      // Daily/trivia/seen-it
      "daily_challenge_responses",
      "daily_runs",
      "seen_it_responses",
      "seen_it_completions",
      "trivia_answers",
      "trivia_results",
      "trivia_user_points",
      // Activity/points/misc
      "activity_logs",
      "user_activity",
      "user_last_activity",
      "points_log",
      "user_points",
      "notifications",
      "user_highlights",
      "user_badges",
      "user_creator_stats",
      "user_flags",
      "login_streaks",
      "bets",
      "cached_recommendations",
      "rec_requests",
      "media_goals",
      "strand_likes",
      "strand_comments",
      "strand_media",
      "strands",
      "beta_feedback",
      // Profile tables
      "profiles",
    ];

    const results: Record<string, string> = {};

    for (const table of deleteSteps) {
      try {
        const { error, count } = await adminClient
          .from(table)
          .delete()
          .eq("user_id", userId);
        
        if (error) {
          results[table] = `error: ${error.message}`;
          console.log(`${table}: ${error.message}`);
        } else {
          results[table] = "ok";
        }
      } catch (e) {
        results[table] = `exception: ${e.message}`;
        console.log(`${table} exception: ${e.message}`);
      }
    }

    // Friendships (user can be on either side)
    try {
      await adminClient.from("friendships").delete().eq("user_id", userId);
      await adminClient.from("friendships").delete().eq("friend_id", userId);
      results["friendships"] = "ok";
    } catch (e) {
      results["friendships"] = `exception: ${e.message}`;
    }

    // Try profiles with 'id' column too
    try {
      await adminClient.from("profiles").delete().eq("id", userId);
    } catch (e) {
      // ignore
    }

    console.log("Table deletion results:", JSON.stringify(results));

    // Finally delete the auth user
    console.log("Attempting to delete auth user...");
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error("Auth deletion error:", JSON.stringify(deleteError));
      return new Response(JSON.stringify({ 
        error: "Failed to delete auth account", 
        authError: deleteError.message,
        tableResults: results 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Account deleted successfully");
    return new Response(JSON.stringify({ success: true }), {
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
