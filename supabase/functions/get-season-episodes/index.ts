import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const externalId = url.searchParams.get("external_id");
    const season = url.searchParams.get("season");

    if (!externalId || !season) {
      return new Response(
        JSON.stringify({ error: "Missing external_id or season parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "2c6d498e18c4ba8ad3dc6fd1bc1f7319";
    
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${externalId}/season/${season}?api_key=${TMDB_API_KEY}`,
      { headers: { "Accept": "application/json" } }
    );

    if (!response.ok) {
      console.error("TMDB API error:", response.status, await response.text());
      return new Response(
        JSON.stringify({ error: "Failed to fetch episodes from TMDB" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    const episodes = (data.episodes || []).map((ep: any) => ({
      episodeNumber: ep.episode_number,
      name: ep.name,
      overview: ep.overview,
      airDate: ep.air_date,
      stillPath: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
      runtime: ep.runtime,
      voteAverage: ep.vote_average,
    }));

    return new Response(
      JSON.stringify({ 
        episodes,
        seasonNumber: data.season_number,
        name: data.name,
        overview: data.overview,
        posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w300${data.poster_path}` : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
