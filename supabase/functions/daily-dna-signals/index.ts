import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find all real (non-persona) users who had any activity in the last 48 hours
  const { data: activeUsers, error } = await supabase.rpc("sql", {
    query: `
      SELECT DISTINCT u.id, u.user_name
      FROM users u
      WHERE u.is_persona IS NOT TRUE
        AND (
          EXISTS (
            SELECT 1 FROM media_ratings mr
            WHERE mr.user_id = u.id
              AND mr.created_at > NOW() - INTERVAL '48 hours'
          )
          OR EXISTS (
            SELECT 1 FROM user_predictions up
            WHERE up.user_id = u.id
              AND up.created_at > NOW() - INTERVAL '48 hours'
          )
          OR EXISTS (
            SELECT 1 FROM dna_moment_responses dmr
            WHERE dmr.user_id = u.id
              AND dmr.created_at > NOW() - INTERVAL '48 hours'
          )
          OR EXISTS (
            SELECT 1 FROM list_items li
            JOIN lists l ON l.id = li.list_id
            WHERE l.user_id = u.id
              AND li.created_at > NOW() - INTERVAL '48 hours'
          )
        )
    `,
  });

  // Fallback: query directly if rpc doesn't work
  let users: { id: string; user_name: string }[] = [];

  if (error || !activeUsers) {
    // Direct query approach
    const { data: ratingUsers } = await supabase
      .from("media_ratings")
      .select("user_id")
      .gt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    const { data: predictionUsers } = await supabase
      .from("user_predictions")
      .select("user_id")
      .gt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    const { data: momentUsers } = await supabase
      .from("dna_moment_responses")
      .select("user_id")
      .gt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    const allIds = [
      ...(ratingUsers || []).map((r) => r.user_id),
      ...(predictionUsers || []).map((p) => p.user_id),
      ...(momentUsers || []).map((m) => m.user_id),
    ];
    const uniqueIds = [...new Set(allIds)];

    if (uniqueIds.length > 0) {
      const { data: usersData } = await supabase
        .from("users")
        .select("id, user_name")
        .in("id", uniqueIds)
        .eq("is_persona", false);
      users = usersData || [];
    }
  } else {
    users = activeUsers;
  }

  if (users.length === 0) {
    return new Response(
      JSON.stringify({ message: "No active users in last 48h", processed: 0 }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[daily-dna-signals] Processing ${users.length} active users`);

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process sequentially to avoid hammering the DB
  for (const u of users) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/extract-dna-signals`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ user_id: u.id }),
        }
      );

      if (res.ok) {
        succeeded++;
      } else {
        failed++;
        errors.push(`${u.user_name}: HTTP ${res.status}`);
      }

      // Small pause between users — no need to rush
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      failed++;
      errors.push(`${u.user_name}: ${e}`);
    }
  }

  const summary = {
    processed: users.length,
    succeeded,
    failed,
    errors: errors.slice(0, 10),
    ran_at: new Date().toISOString(),
  };

  console.log("[daily-dna-signals] Done:", summary);

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});
