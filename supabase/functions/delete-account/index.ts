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

    const tablesToDelete = [
      { table: "social_posts", filter: { user_id: userId } },
      { table: "media_ratings", filter: { user_id: userId } },
      { table: "user_predictions", filter: { user_id: userId } },
      { table: "user_media", filter: { user_id: userId } },
      { table: "list_items", filter: { user_id: userId } },
      { table: "custom_lists", filter: { user_id: userId } },
      { table: "login_streaks", filter: { user_id: userId } },
      { table: "dna_profiles", filter: { user_id: userId } },
      { table: "dna_moment_responses", filter: { user_id: userId } },
      { table: "user_sessions", filter: { user_id: userId } },
      { table: "notifications", filter: { user_id: userId } },
      { table: "post_likes", filter: { user_id: userId } },
      { table: "highlights", filter: { user_id: userId } },
    ];

    for (const { table, filter } of tablesToDelete) {
      try {
        await adminClient.from(table).delete().eq(Object.keys(filter)[0], Object.values(filter)[0]);
      } catch (e) {
        console.log(`Skipping table ${table}:`, e.message);
      }
    }

    try {
      await adminClient.from("friendships").delete().eq("user_id", userId);
      await adminClient.from("friendships").delete().eq("friend_id", userId);
    } catch (e) {
      console.log("Skipping friendships:", e.message);
    }

    try {
      await adminClient.from("users").delete().eq("id", userId);
    } catch (e) {
      console.log("Skipping users table:", e.message);
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete auth account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
