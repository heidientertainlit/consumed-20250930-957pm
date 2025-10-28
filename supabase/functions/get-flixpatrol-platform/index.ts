import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=21600' // Cache for 6 hours
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { platform, mediaType } = await req.json();
    
    if (!platform || !mediaType) {
      return new Response(JSON.stringify({ error: 'Platform and mediaType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const FLIXPATROL_API_KEY = Deno.env.get('FLIXPATROL_API_KEY');
    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
    
    if (!FLIXPATROL_API_KEY) {
      console.log('No FlixPatrol API key, using TMDB trending as fallback');
      // Fallback to TMDB trending
      return await fetchTMDBTrending(mediaType, TMDB_API_KEY);
    }

    // Get today's date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Map platform names to FlixPatrol platform IDs
    const platformMap: Record<string, string> = {
      'netflix': 'netflix',
      'hbo': 'hbo',
      'paramount': 'paramount-plus',
      'disney': 'disney-plus',
      'prime': 'amazon-prime',
      'hulu': 'hulu',
      'apple': 'apple-tv-plus'
    };

    const flixpatrolPlatform = platformMap[platform.toLowerCase()] || platform;
    const flixpatrolMediaType = mediaType === 'movie' ? 'movies' : 'tv-shows';

    // Fetch from FlixPatrol
    const flixpatrolUrl = `https://api.flixpatrol.com/v1/top10/${flixpatrolPlatform}/${flixpatrolMediaType}/united-states/${dateStr}`;
    
    console.log('Fetching from FlixPatrol:', flixpatrolUrl);
    
    const flixpatrolResponse = await fetch(flixpatrolUrl, {
      headers: {
        'X-API-Key': FLIXPATROL_API_KEY
      }
    });

    if (!flixpatrolResponse.ok) {
      console.error('FlixPatrol API error:', flixpatrolResponse.status, await flixpatrolResponse.text());
      // Fallback to TMDB
      return await fetchTMDBTrending(mediaType, TMDB_API_KEY);
    }

    const flixpatrolData = await flixpatrolResponse.json();
    
    // Extract top 10 items
    const top10Items = flixpatrolData.top10 || [];
    
    if (top10Items.length === 0) {
      console.log('No FlixPatrol data, using TMDB fallback');
      return await fetchTMDBTrending(mediaType, TMDB_API_KEY);
    }

    // Enrich with TMDB data
    const enrichedItems = await Promise.all(
      top10Items.slice(0, 10).map(async (item: any) => {
        try {
          // Search TMDB for the title
          const searchQuery = encodeURIComponent(item.title);
          const tmdbSearchUrl = `https://api.themoviedb.org/3/search/${mediaType === 'movie' ? 'movie' : 'tv'}?api_key=${TMDB_API_KEY}&query=${searchQuery}`;
          
          const tmdbResponse = await fetch(tmdbSearchUrl);
          if (!tmdbResponse.ok) {
            return null;
          }

          const tmdbData = await tmdbResponse.json();
          const tmdbItem = tmdbData.results?.[0];

          if (!tmdbItem) {
            return null;
          }

          return {
            id: tmdbItem.id.toString(),
            title: tmdbItem.title || tmdbItem.name,
            imageUrl: tmdbItem.poster_path 
              ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}`
              : '',
            rating: tmdbItem.vote_average ? Math.round(tmdbItem.vote_average * 10) / 10 : undefined,
            year: (tmdbItem.release_date || tmdbItem.first_air_date) 
              ? new Date(tmdbItem.release_date || tmdbItem.first_air_date).getFullYear().toString() 
              : undefined,
            mediaType: mediaType,
            rank: item.rank
          };
        } catch (error) {
          console.error('Error enriching item:', error);
          return null;
        }
      })
    );

    // Filter out nulls and return
    const validItems = enrichedItems.filter(item => item !== null);

    if (validItems.length === 0) {
      return await fetchTMDBTrending(mediaType, TMDB_API_KEY);
    }

    return new Response(JSON.stringify(validItems), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in FlixPatrol function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Fallback to TMDB trending
async function fetchTMDBTrending(mediaType: string, apiKey: string | undefined) {
  if (!apiKey) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const tmdbType = mediaType === 'movie' ? 'movie' : 'tv';
  const trendingUrl = `https://api.themoviedb.org/3/trending/${tmdbType}/day?api_key=${apiKey}`;
  
  const response = await fetch(trendingUrl);
  if (!response.ok) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const data = await response.json();
  const formattedItems = data.results.slice(0, 10).map((item: any) => ({
    id: item.id.toString(),
    title: item.title || item.name,
    imageUrl: item.poster_path 
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : '',
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
    year: (item.release_date || item.first_air_date) 
      ? new Date(item.release_date || item.first_air_date).getFullYear().toString() 
      : undefined,
    mediaType: mediaType
  }));

  return new Response(JSON.stringify(formattedItems), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
