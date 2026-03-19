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

    const reporterId = appUser?.id ?? user.id;

    const { content_type, content_id, reason, description, reported_user_id } = await req.json();

    if (!content_type || !content_id || !reason) {
      return json({ error: "Missing required fields: content_type, content_id, reason" }, 400);
    }

    const validContentTypes = ["post", "comment", "hot_take", "list", "review", "user"];
    const validReasons = ["spam", "harassment", "hate_speech", "misinformation", "inappropriate", "spoiler", "other"];

    if (!validContentTypes.includes(content_type)) return json({ error: "Invalid content type" }, 400);
    if (!validReasons.includes(reason)) return json({ error: "Invalid reason" }, 400);

    // Use service role to bypass RLS
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check for duplicate report
    const { data: existing } = await admin
      .from("content_reports")
      .select("id")
      .eq("reporter_id", reporterId)
      .eq("content_type", content_type)
      .eq("content_id", content_id)
      .maybeSingle();

    if (existing) return json({ error: "You have already reported this content" }, 400);

    const { data: report, error: insertError } = await admin
      .from("content_reports")
      .insert({
        reporter_id: reporterId,
        content_type,
        content_id,
        reason,
        description: description || null,
        reported_user_id: reported_user_id || null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return json({ error: "Failed to submit report" }, 500);
    }

    return json({ success: true, report_id: report.id });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
