import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function deleteRows(client: any, table: string, column: string, value: string) {
  try {
    const { error } = await client.from(table).delete().eq(column, value);
    return error ? `error: ${error.message}` : "ok";
  } catch (e: any) {
    return `exception: ${e.message}`;
  }
}

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

    const userClient = createClient(supabaseUrl, anonKey, {
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
    console.log("Deleting account for user:", userId);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const results: Record<string, string> = {};

    // Step 1: Get IDs of user's posts, ranks, strands, lists for cascading deletes
    const { data: userPosts } = await admin.from("social_posts").select("id").eq("user_id", userId);
    const postIds = (userPosts || []).map((p: any) => p.id);

    const { data: userRanks } = await admin.from("ranks").select("id").eq("user_id", userId);
    const rankIds = (userRanks || []).map((r: any) => r.id);

    const { data: userStrands } = await admin.from("strands").select("id").eq("user_id", userId);
    const strandIds = (userStrands || []).map((s: any) => s.id);

    const { data: userLists } = await admin.from("lists").select("id").eq("user_id", userId);
    const listIds = (userLists || []).map((l: any) => l.id);

    const { data: userComments } = await admin.from("social_post_comments").select("id").eq("user_id", userId);
    const commentIds = (userComments || []).map((c: any) => c.id);

    console.log(`Found: ${postIds.length} posts, ${rankIds.length} ranks, ${strandIds.length} strands, ${listIds.length} lists, ${commentIds.length} comments`);

    // Step 2: Delete children of user's content (likes/votes on their posts)
    if (postIds.length > 0) {
      for (const pid of postIds) {
        await admin.from("social_post_likes").delete().eq("post_id", pid);
        await admin.from("social_post_comments").delete().eq("post_id", pid);
        await admin.from("post_votes").delete().eq("post_id", pid);
      }
    }

    if (commentIds.length > 0) {
      for (const cid of commentIds) {
        await admin.from("social_comment_likes").delete().eq("comment_id", cid);
        await admin.from("social_comment_votes").delete().eq("comment_id", cid);
      }
    }

    if (rankIds.length > 0) {
      for (const rid of rankIds) {
        await admin.from("rank_item_votes").delete().eq("rank_id", rid);
        await admin.from("rank_comments").delete().eq("rank_id", rid);
        await admin.from("rank_items").delete().eq("rank_id", rid);
      }
    }

    if (strandIds.length > 0) {
      for (const sid of strandIds) {
        await admin.from("strand_likes").delete().eq("strand_id", sid);
        await admin.from("strand_comments").delete().eq("strand_id", sid);
        await admin.from("strand_media").delete().eq("strand_id", sid);
      }
    }

    if (listIds.length > 0) {
      for (const lid of listIds) {
        await admin.from("list_items").delete().eq("list_id", lid);
        await admin.from("list_collaborators").delete().eq("list_id", lid);
      }
    }

    // Step 3: Delete all user_id referenced data
    const userIdTables = [
      "social_comment_likes", "social_comment_votes",
      "social_post_likes", "social_post_comments", "post_votes", "social_posts",
      "prediction_comment_likes", "prediction_comment_votes",
      "prediction_comments", "prediction_likes", "predictions",
      "user_predictions", "user_prediction_stats",
      "media_ratings", "ratings", "reviews",
      "media_history_log", "user_media_items", "user_media",
      "list_collaborators", "list_items", "user_lists", "lists",
      "rank_comments", "rank_items", "ranks",
      "dna_moment_responses", "dna_profiles", "edna_responses",
      "user_dna_levels", "user_dna_signals", "celebrity_dna",
      "entertainment_dna",
      "friend_cast_responses", "friend_casts",
      "friends_trivia", "followed_creators",
      "hot_take_votes", "hot_take_passes",
      "poll_responses", "pool_answers", "pool_members",
      "awards_picks", "awards_ballot_completions",
      "daily_challenge_responses", "daily_runs",
      "seen_it_responses", "seen_it_completions",
      "trivia_answers", "trivia_results", "trivia_user_points",
      "activity_logs", "user_activity", "user_last_activity",
      "points_log", "user_points",
      "notifications", "user_highlights", "user_badges",
      "user_creator_stats", "user_flags",
      "login_streaks", "bets",
      "cached_recommendations", "rec_requests", "media_goals",
      "beta_feedback",
      "strand_likes", "strand_comments", "strand_media", "strands",
      "public_feed", "user_sessions",
    ];

    for (const table of userIdTables) {
      results[table] = await deleteRows(admin, table, "user_id", userId);
    }

    // Tables that use different column names
    results["friendships_user"] = await deleteRows(admin, "friendships", "user_id", userId);
    results["friendships_friend"] = await deleteRows(admin, "friendships", "friend_id", userId);
    results["friend_invitations_inviter"] = await deleteRows(admin, "friend_invitations", "inviter_id", userId);
    results["friend_invitations_invitee"] = await deleteRows(admin, "friend_invitations", "invitee_id", userId);
    results["dna_comparisons_user"] = await deleteRows(admin, "dna_comparisons", "user_id", userId);
    results["dna_comparisons_friend"] = await deleteRows(admin, "dna_comparisons", "friend_id", userId);
    results["rank_item_votes_voter"] = await deleteRows(admin, "rank_item_votes", "voter_id", userId);

    // Profiles table - try both id and user_id
    results["profiles_id"] = await deleteRows(admin, "profiles", "id", userId);
    results["profiles_user_id"] = await deleteRows(admin, "profiles", "user_id", userId);

    // Log failures only
    const failures = Object.entries(results).filter(([_, v]) => v !== "ok" && !v.includes("does not exist"));
    console.log("Failures:", JSON.stringify(failures));
    console.log("Total tables processed:", Object.keys(results).length);

    // Step 4: Delete auth user
    console.log("Deleting auth user...");
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Auth deletion failed:", JSON.stringify(deleteError));
      return new Response(JSON.stringify({
        error: "Failed to delete auth account",
        authError: deleteError.message,
        failures
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
  } catch (err: any) {
    console.error("Delete account error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
