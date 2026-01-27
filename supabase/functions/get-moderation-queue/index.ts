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

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending";
    const limit = parseInt(url.searchParams.get("limit") || "50");

    // Get reports with reporter info
    const { data: reports, error: reportsError } = await supabase
      .from("content_reports")
      .select(`
        *,
        reporter:profiles!content_reports_reporter_id_fkey(id, display_name, username, avatar_url)
      `)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (reportsError) {
      console.error("Error fetching reports:", reportsError);
      return new Response(JSON.stringify({ error: "Failed to fetch reports" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich reports with content details
    const enrichedReports = await Promise.all((reports || []).map(async (report) => {
      let content = null;
      let contentAuthor = null;

      if (report.content_type === 'post') {
        const { data } = await supabase
          .from("social_posts")
          .select(`
            id, content, created_at,
            author:profiles!social_posts_user_id_fkey(id, display_name, username)
          `)
          .eq("id", report.content_id)
          .single();
        content = data;
        contentAuthor = data?.author;
      } else if (report.content_type === 'comment') {
        const { data } = await supabase
          .from("comments")
          .select(`
            id, content, created_at,
            author:profiles!comments_user_id_fkey(id, display_name, username)
          `)
          .eq("id", report.content_id)
          .single();
        content = data;
        contentAuthor = data?.author;
      } else if (report.content_type === 'hot_take') {
        const { data } = await supabase
          .from("hot_takes")
          .select(`
            id, content, created_at,
            author:profiles!hot_takes_user_id_fkey(id, display_name, username)
          `)
          .eq("id", report.content_id)
          .single();
        content = data;
        contentAuthor = data?.author;
      }

      return {
        ...report,
        content,
        content_author: contentAuthor,
      };
    }));

    // Get stats
    const { data: pendingCount } = await supabase
      .from("content_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { data: resolvedCount } = await supabase
      .from("content_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved");

    return new Response(JSON.stringify({
      reports: enrichedReports,
      stats: {
        pending: pendingCount,
        resolved: resolvedCount,
      }
    }), {
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
