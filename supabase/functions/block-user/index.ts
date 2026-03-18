import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Look up app user by email
    const { data: appUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email)
      .single();

    const blockerId = appUser?.id ?? user.id;

    const { blocked_user_id, action = "block" } = await req.json();
    if (!blocked_user_id) return json({ error: "blocked_user_id is required" }, 400);
    if (blockerId === blocked_user_id) return json({ error: "Cannot block yourself" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (action === "unblock") {
      await admin
        .from("user_blocks")
        .delete()
        .eq("blocker_id", blockerId)
        .eq("blocked_id", blocked_user_id);
      return json({ success: true, action: "unblocked" });
    }

    // Check if already blocked
    const { data: existing } = await admin
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blocked_user_id)
      .maybeSingle();

    if (existing) return json({ success: true, action: "already_blocked" });

    const { error: insertError } = await admin
      .from("user_blocks")
      .insert({ blocker_id: blockerId, blocked_id: blocked_user_id });

    if (insertError) {
      console.error("Insert error:", insertError);
      return json({ error: "Failed to block user" }, 500);
    }

    // Remove friendship in both directions
    await admin
      .from("friendships")
      .delete()
      .or(`and(user_id.eq.${blockerId},friend_id.eq.${blocked_user_id}),and(user_id.eq.${blocked_user_id},friend_id.eq.${blockerId})`);

    return json({ success: true, action: "blocked" });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
