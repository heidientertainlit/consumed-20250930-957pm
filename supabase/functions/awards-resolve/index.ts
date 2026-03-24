import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 98th Academy Awards - Correct Winners
// key = category_id, value = { name?: string, title?: string } to match nominee
const OSCAR_WINNERS: Record<string, { name?: string; title?: string }> = {
  "cat-osc26-picture":        { title: "One Battle After Another" },
  "cat-osc26-director":       { name: "Paul Thomas Anderson" },
  "cat-osc26-actor":          { name: "Michael B. Jordan" },
  "cat-osc26-actress":        { name: "Jessie Buckley" },
  "cat-osc26-sup-actor":      { name: "Sean Penn" },
  "cat-osc26-sup-actress":    { name: "Amy Madigan" },
  "cat-osc26-orig-screenplay":{ name: "Ryan Coogler" },
  "cat-osc26-adapt-screenplay":{ name: "Paul Thomas Anderson" },
  "cat-osc26-animated":       { title: "KPop Demon Hunters" },
  "cat-osc26-intl":           { title: "Sentimental Value" },
  "cat-osc26-doc":            { title: "Mr. Nobody Against Putin" },
  "cat-osc26-cinematography": { name: "Autumn Durald Arkapaw" },
  "cat-osc26-vfx":            { title: "Avatar: Fire and Ash" },
  "cat-osc26-casting":        { name: "Cassandra Kulukundis" },
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findWinner(nominees: any[], winner: { name?: string; title?: string }): string | null {
  for (const nom of nominees) {
    // Try name match (person_name or name field)
    if (winner.name) {
      const nomName = (nom.person_name || nom.name || "").toLowerCase();
      const winName = winner.name.toLowerCase();
      if (nomName.includes(winName) || winName.includes(nomName.split(" ").pop() || "")) {
        return nom.id;
      }
    }
    // Try title match
    if (winner.title) {
      const nomTitle = (nom.title || nom.name || "").toLowerCase();
      const winTitle = winner.title.toLowerCase();
      if (normalize(nomTitle).includes(normalize(winTitle)) || normalize(winTitle).includes(normalize(nomTitle))) {
        return nom.id;
      }
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Admin-only: require secret token
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const adminSecret = Deno.env.get("AWARDS_RESOLVE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!token || token !== adminSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("awards-resolve: starting");

    // 1. Get the Oscar event
    const { data: event, error: eventErr } = await supabase
      .from("awards_events")
      .select("id, slug, name, points_per_correct, status")
      .eq("slug", "oscars-2026")
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found", detail: eventErr }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Event:", event.name, "status:", event.status, "pts_per_correct:", event.points_per_correct);
    const pointsPerCorrect = event.points_per_correct || 10;

    // 2. Fetch all categories with nominees
    const { data: categories, error: catErr } = await supabase
      .from("awards_categories")
      .select("id, name, winner_nominee_id, nominees:awards_nominees(*)")
      .eq("event_id", event.id);

    if (catErr || !categories) {
      return new Response(JSON.stringify({ error: "Failed to fetch categories", detail: catErr }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${categories.length} categories`);

    // 3. Match winners and update categories
    const results: Record<string, { categoryName: string; winnerNomineeId: string | null; matched: boolean }> = {};

    for (const cat of categories) {
      const winnerSpec = OSCAR_WINNERS[cat.id];
      if (!winnerSpec) {
        console.log(`No winner defined for category: ${cat.id} (${cat.name})`);
        continue;
      }

      const nominees = (cat.nominees as any[]) || [];
      const winnerId = findWinner(nominees, winnerSpec);

      if (winnerId) {
        const winnerNom = nominees.find((n: any) => n.id === winnerId);
        console.log(`  ✓ ${cat.name}: matched "${winnerNom?.person_name || winnerNom?.name || winnerNom?.title}" (id: ${winnerId})`);

        const { error: updateErr } = await supabase
          .from("awards_categories")
          .update({ winner_nominee_id: winnerId })
          .eq("id", cat.id);

        if (updateErr) {
          console.error(`  ✗ Failed to update ${cat.name}:`, updateErr);
        }

        results[cat.id] = { categoryName: cat.name, winnerNomineeId: winnerId, matched: true };
      } else {
        const nomNames = nominees.map((n: any) => n.person_name || n.name || n.title).join(", ");
        console.log(`  ✗ No match for ${cat.name}. Looking for: ${JSON.stringify(winnerSpec)}. Available: ${nomNames}`);
        results[cat.id] = { categoryName: cat.name, winnerNomineeId: null, matched: false };
      }
    }

    // 4. Mark event as completed
    const { error: statusErr } = await supabase
      .from("awards_events")
      .update({ status: "completed" })
      .eq("id", event.id);

    if (statusErr) {
      console.error("Failed to set event status:", statusErr);
    } else {
      console.log("Event marked as completed");
    }

    // 5. Fetch all picks for this event
    const categoryIds = categories.map((c: any) => c.id);
    const { data: allPicks, error: picksErr } = await supabase
      .from("awards_picks")
      .select("user_id, category_id, nominee_id")
      .in("category_id", categoryIds);

    if (picksErr) {
      console.error("Failed to fetch picks:", picksErr);
    }

    const picks = allPicks || [];
    console.log(`Found ${picks.length} total picks across ${new Set(picks.map((p: any) => p.user_id)).size} users`);

    // Build winner map: category_id → winning nominee_id
    const winnerMap: Record<string, string> = {};
    for (const [catId, result] of Object.entries(results)) {
      if (result.winnerNomineeId) winnerMap[catId] = result.winnerNomineeId;
    }

    // 6. Score each user
    const userScores: Record<string, { correct: number; total: number; points: number }> = {};
    for (const pick of picks) {
      const uid = pick.user_id;
      if (!userScores[uid]) userScores[uid] = { correct: 0, total: 0, points: 0 };
      userScores[uid].total++;
      const expectedWinner = winnerMap[pick.category_id];
      if (expectedWinner && pick.nominee_id === expectedWinner) {
        userScores[uid].correct++;
        userScores[uid].points += pointsPerCorrect;
      }
    }

    console.log(`Scoring ${Object.keys(userScores).length} users`);

    // 7. Store in awards_ballot_completions + award points
    let pointsAwarded = 0;
    const scoreSummary: any[] = [];

    for (const [userId, score] of Object.entries(userScores)) {
      // Upsert into awards_ballot_completions
      const { error: completionErr } = await supabase
        .from("awards_ballot_completions")
        .upsert({
          id: `${userId}-${event.id}`,
          user_id: userId,
          event_id: event.id,
          total_correct: score.correct,
          total_points: score.points,
          completed_at: new Date().toISOString(),
        }, { onConflict: "user_id,event_id" });

      if (completionErr) {
        console.error(`Failed to save completion for ${userId}:`, completionErr);
      }

      // Award points to user_points table (predictions category)
      if (score.points > 0) {
        // Get current predictions points
        const { data: existing } = await supabase
          .from("user_points")
          .select("points")
          .eq("user_id", userId)
          .eq("category", "predictions")
          .maybeSingle();

        const newPoints = (existing?.points || 0) + score.points;

        await supabase
          .from("user_points")
          .upsert({ user_id: userId, category: "predictions", points: newPoints }, { onConflict: "user_id,category" });

        // Also store separately as 'awards' category so it isn't overwritten
        await supabase
          .from("user_points")
          .upsert({ user_id: userId, category: "awards", points: score.points }, { onConflict: "user_id,category" });

        pointsAwarded++;
      }

      scoreSummary.push({ userId, correct: score.correct, total: score.total, points: score.points });
    }

    return new Response(JSON.stringify({
      success: true,
      event: event.name,
      categoriesResolved: Object.values(results).filter((r) => r.matched).length,
      categoriesUnmatched: Object.values(results).filter((r) => !r.matched).length,
      usersScored: Object.keys(userScores).length,
      usersAwardedPoints: pointsAwarded,
      categoryResults: results,
      scoreSummary,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("awards-resolve error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
