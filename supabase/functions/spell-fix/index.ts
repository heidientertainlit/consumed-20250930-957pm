import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Tiny helper: given a search query that returned ZERO results, guess the
// corrected media title (e.g. "downtown abbey" -> "Downton Abbey").
// Deliberately standalone — media-search is never touched. Callers only hit
// this after an empty result set, so the worst case equals current behavior.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, type } = await req.json().catch(() => ({}));
    if (!query || typeof query !== "string" || query.trim().length < 3 || query.length > 120) {
      return new Response(JSON.stringify({ corrected: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ corrected: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mediaHint = type ? ` The user was searching for a ${type}.` : "";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 40,
        messages: [
          {
            role: "system",
            content:
              `A user searched an entertainment app (movies, TV, books, music, podcasts) and got zero results, likely due to a misspelling.${mediaHint} ` +
              `If the query looks like a misspelled real title or artist/author name, reply with ONLY the corrected name. ` +
              `If you are not confident it is a misspelling of something real, reply with ONLY the word NULL.`,
          },
          { role: "user", content: query.slice(0, 120) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = await res.json();
    let corrected: string | null = (data.choices?.[0]?.message?.content || "").trim();
    if (!corrected || corrected.toUpperCase() === "NULL" || corrected.length > 120) corrected = null;
    // No-op corrections are useless — don't trigger a retry loop.
    if (corrected && corrected.toLowerCase() === query.trim().toLowerCase()) corrected = null;

    return new Response(JSON.stringify({ corrected }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[spell-fix]", e);
    return new Response(JSON.stringify({ corrected: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
