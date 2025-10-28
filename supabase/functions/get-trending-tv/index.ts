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

    // ✨ CHANGED: From 'week' to 'day' for fresher content
    const trendingResponse = await fetch(
      `https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_API_KEY}`
    );
    
    if (!trendingResponse.ok) {
      throw new Error('Failed to fetch from TMDB');
    }

    const trendingData = await trendingResponse.json();
    
    // Map provider IDs to platform names
    const providerMap: Record<number, string> = {
      8: 'netflix',
      337: 'disney',
      15: 'hulu',
      9: 'prime',
      384: 'max',
      387: 'peacock',
      350: 'apple',
      531: 'paramount',
    };

    // Fetch platform info for each TV show and format the response
    const formattedShows = await Promise.all(
      trendingData.results.slice(0, 10).map(async (show: any) => {
        // Fetch watch providers for this show
        let platform = undefined;
        try {
          const providersResponse = await fetch(
            `https://api.themoviedb.org/3/tv/${show.id}/watch/providers?api_key=${TMDB_API_KEY}`
          );
          if (providersResponse.ok) {
            const providersData = await providersResponse.json();
            const usProviders = providersData.results?.US;
            
            // Check flatrate (subscription) providers first
            if (usProviders?.flatrate && usProviders.flatrate.length > 0) {
              const providerId = usProviders.flatrate[0].provider_id;
              platform = providerMap[providerId];
            }
          }
        } catch (error) {
          console.error(`Failed to fetch providers for show ${show.id}:`, error);
        }

        return {
          id: show.id.toString(),
          title: show.name,
          imageUrl: show.poster_path 
            ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
            : '',
          rating: show.vote_average ? Math.round(show.vote_average * 10) / 10 : undefined,
          year: show.first_air_date ? new Date(show.first_air_date).getFullYear().toString() : undefined,
          mediaType: 'tv',
          platform,
        };
      })
    );

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
