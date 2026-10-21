import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { balanceUSChartItems, loadUSCharts, recoverCachedMusic } from "../_shared/us-media-charts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    // Never reuse the previous global/Consumed/TMDB payload for verified US charts.
    const cacheKey = "us-top-charts-v2-flat-covers";
    let cached: any = null;
    try {
      const { data } = await admin.from("trending_content_cache")
        .select("payload, updated_at").eq("cache_key", cacheKey).single();
      cached = data;
    } catch { /* Cache is optional; chart requests still work without it. */ }
    const age = cached?.updated_at ? Date.now() - new Date(cached.updated_at).getTime() : Infinity;
    const today = new Date().toISOString().slice(0, 10);
    const sameDay = cached?.payload?.generated_at?.slice(0, 10) === today;
    // Share one paid chart refresh per day across all visitors and all filters.
    // Failed streaming access gets a shorter retry window so activation can recover.
    const ttl = cached?.payload?.source_status?.streaming === "available" ? 86400000 : 3600000;
    if (cached?.payload?.schema_version === 2 && sameDay && age < ttl) {
      const recovered = await recoverCachedMusic(cached.payload);
      if (recovered !== cached.payload) {
        // Preserve the paid charts' original age and generation timestamp.
        const { error } = await admin.from("trending_content_cache").upsert({
          cache_key: cacheKey, payload: recovered, updated_at: cached.updated_at,
        });
        if (error) console.error("Music chart recovery cache write failed");
      }
      return new Response(JSON.stringify({ ...recovered, items: balanceUSChartItems(recovered.items) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": recovered === cached.payload ? "HIT" : "PARTIAL-REFRESH" },
      });
    }
    const payload = await loadUSCharts({
      flixKey: Deno.env.get("FLIXPATROL_API_KEY"), tmdbKey: Deno.env.get("TMDB_API_KEY"),
      nytKey: Deno.env.get("NYT_API_KEY"),
      openaiKey: Deno.env.get("OPENAI_API_KEY"), googleBooksKey: Deno.env.get("GOOGLE_BOOKS_API_KEY"),
      coverCache: {
        async get(key) {
          const { data, error } = await admin.from("trending_content_cache").select("payload")
            .eq("cache_key", key).abortSignal(AbortSignal.timeout(2000)).maybeSingle();
          if (error) throw new Error("Cover cache read failed");
          return data?.payload;
        },
        async set(key, value) {
          const { error } = await admin.from("trending_content_cache")
            .upsert({ cache_key: key, payload: value, updated_at: new Date().toISOString() })
            .abortSignal(AbortSignal.timeout(2000));
          if (error) throw new Error("Cover cache write failed");
        },
      },
    });
    // Preserve bounded, real previous charts per source during a provider outage.
    // Do not label stale results as fresh or fall back to global/Consumed activity.
    if (cached?.payload?.schema_version === 2 && age < 3 * 86400000) {
      const sourceGroup = (type: string) => type === "movie" || type === "tv" ? "streaming"
        : type === "book" ? "books" : type === "podcast" ? "podcasts" : "music";
      for (const group of Object.keys(payload.source_status)) {
        if (payload.source_status[group] !== "unavailable") continue;
        const previous = (cached.payload.items || []).filter((item: any) =>
          item.chart_country === "US" && sourceGroup(item.media_type) === group
          && item.chart_date && Date.now() - new Date(item.chart_date).getTime() < (group === "books" ? 10 : 3) * 86400000);
        if (previous.length) {
          payload.items.push(...previous);
          payload.source_status[group] = "stale";
        }
      }
    }
    if (payload.items.length) {
      payload.items = balanceUSChartItems(payload.items);
      const { error } = await admin.from("trending_content_cache")
        .upsert({ cache_key: cacheKey, payload, updated_at: new Date().toISOString() });
      if (error) console.error("US chart cache write failed");
    }
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch {
    console.error("US chart request failed");
    return new Response(JSON.stringify({ items: [], error: "Could not load US charts." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
