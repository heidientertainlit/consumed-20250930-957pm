import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeAdminOrService } from "../_shared/authorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authorization = await authorizeAdminOrService(req);
  if (!authorization.authorized) {
    return jsonResponse({ error: authorization.error }, authorization.status);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Total registered users
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // New users last 30 days
    const { count: newUsers30d } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Daily Active Users (users who tracked media in last 24 hours)
    const { data: dauData } = await supabase
      .from("list_items")
      .select("user_id")
      .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
    const dau = new Set(dauData?.map((item) => item.user_id)).size;

    // Weekly Active Users
    const { data: wauData } = await supabase
      .from("list_items")
      .select("user_id")
      .gte("created_at", sevenDaysAgo.toISOString());
    const wau = new Set(wauData?.map((item) => item.user_id)).size;

    // Monthly Active Users
    const { data: mauData } = await supabase
      .from("list_items")
      .select("user_id")
      .gte("created_at", thirtyDaysAgo.toISOString());
    const mau = new Set(mauData?.map((item) => item.user_id)).size;

    // Total media items tracked
    const { count: totalMediaTracked } = await supabase
      .from("list_items")
      .select("*", { count: "exact", head: true });

    // DNA survey completion rate
    const { count: dnaProfilesCount } = await supabase
      .from("dna_profiles")
      .select("*", { count: "exact", head: true });

    // Social engagement
    const { count: socialPostsCount } = await supabase
      .from("social_feed_posts")
      .select("*", { count: "exact", head: true });

    const featureAdoption = {
      dnaCompletion: totalUsers > 0 ? (dnaProfilesCount / totalUsers * 100).toFixed(1) : 0,
      mediaTracking: totalUsers > 0 ? (mau / totalUsers * 100).toFixed(1) : 0,
      socialSharing: totalUsers > 0 ? (socialPostsCount / totalUsers * 100).toFixed(1) : 0,
    };

    // User retention (7-day return rate)
    const { data: retentionData } = await supabase
      .from("users")
      .select("id, created_at")
      .lt("created_at", sevenDaysAgo.toISOString());

    let returnedUsers = 0;
    if (retentionData) {
      for (const user of retentionData) {
        const userReturnDate = new Date(user.created_at);
        userReturnDate.setDate(userReturnDate.getDate() + 7);

        const { data: userActivity } = await supabase
          .from("list_items")
          .select("id")
          .eq("user_id", user.id)
          .gte("created_at", userReturnDate.toISOString())
          .limit(1);

        if (userActivity && userActivity.length > 0) {
          returnedUsers++;
        }
      }
    }

    const retentionRate = retentionData?.length > 0
      ? (returnedUsers / retentionData.length * 100).toFixed(1)
      : 0;

    // Daily activity trend (last 30 days)
    const dailyActivity = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const { data: dayActivity } = await supabase
        .from("list_items")
        .select("user_id")
        .gte("created_at", date.toISOString())
        .lt("created_at", nextDate.toISOString());

      dailyActivity.push({
        date: date.toISOString().split("T")[0],
        activeUsers: new Set(dayActivity?.map((item) => item.user_id)).size,
        itemsTracked: dayActivity?.length || 0,
      });
    }

    return jsonResponse({
      overview: {
        totalUsers,
        newUsers30d,
        dau,
        wau,
        mau,
        totalMediaTracked,
        retentionRate: `${retentionRate}%`,
      },
      featureAdoption,
      dailyActivity,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});