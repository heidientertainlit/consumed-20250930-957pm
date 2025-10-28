import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
    
    if (!TMDB_API_KEY) {
      return new Response(JSON.stringify({ error: 'TMDB API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch daily trending TV shows
    const trendingResponse = await fetch(
      `https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_API_KEY}`
    );
    
    if (!trendingResponse.ok) {
      throw new Error('Failed to fetch from TMDB');
    }

    const trendingData = await trendingResponse.json();
    
    // Format the response - simple version
    const formattedShows = trendingData.results.slice(0, 20).map((show: any) => ({
      id: show.id.toString(),
      title: show.name,
      imageUrl: show.poster_path 
        ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
        : '',
      rating: show.vote_average ? Math.round(show.vote_average * 10) / 10 : undefined,
      year: show.first_air_date ? new Date(show.first_air_date).getFullYear().toString() : undefined,
      mediaType: 'tv',
    }));

    return new Response(JSON.stringify(formattedShows), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching trending TV shows:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch trending TV shows' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
