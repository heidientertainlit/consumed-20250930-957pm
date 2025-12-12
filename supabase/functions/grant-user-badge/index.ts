import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Admin authorization check - require service role key or admin token
    const adminToken = req.headers.get("x-admin-token");
    const authHeader = req.headers.get("authorization");
    const expectedAdminToken = Deno.env.get("ADMIN_SECRET_TOKEN");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Allow if: admin token matches OR auth header contains service role key
    const isAuthorized = 
      (expectedAdminToken && adminToken === expectedAdminToken) ||
      (authHeader && authHeader.includes(serviceRoleKey));
    
    if (!isAuthorized) {
      console.error("Unauthorized badge grant attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized - admin access required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action = "grant", user_id, badge_slug, awarded_by, notes } = body;

    if (!user_id || !badge_slug) {
      return new Response(
        JSON.stringify({ error: "user_id and badge_slug are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up badge by slug
    const { data: badge, error: badgeError } = await supabase
      .from("badges")
      .select("id, name")
      .eq("slug", badge_slug)
      .single();

    if (badgeError || !badge) {
      return new Response(
        JSON.stringify({ error: `Badge not found: ${badge_slug}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "revoke") {
      // Remove badge from user
      const { error: deleteError } = await supabase
        .from("user_badges")
        .delete()
        .eq("user_id", user_id)
        .eq("badge_id", badge.id);

      if (deleteError) {
        console.error("Error revoking badge:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to revoke badge", details: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: `Badge '${badge.name}' revoked from user` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Grant badge (upsert to handle duplicates gracefully)
    const { error: insertError } = await supabase
      .from("user_badges")
      .upsert({
        user_id,
        badge_id: badge.id,
        awarded_at: new Date().toISOString(),
        awarded_by: awarded_by || null,
        notes: notes || null
      }, {
        onConflict: "user_id,badge_id"
      });

    if (insertError) {
      console.error("Error granting badge:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to grant badge", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Badge '${badge.name}' granted to user` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
