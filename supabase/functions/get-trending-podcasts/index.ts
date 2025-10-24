import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
    const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: 'Spotify API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Spotify access token
    const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Spotify access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Search for popular podcasts
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=genre:podcast&type=show&market=US&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to fetch podcasts from Spotify');
    }

    const searchData = await searchResponse.json();
    const shows = searchData.shows?.items || [];

    const formattedPodcasts = shows.map((show: any) => ({
      id: show.id,
      title: show.name,
      imageUrl: show.images && show.images.length > 0 ? show.images[0].url : '',
      rating: undefined,
      year: undefined,
      mediaType: 'podcast',
      platform: 'spotify',
      author: show.publisher || '',
      description: show.description || '',
    }));

    return new Response(JSON.stringify(formattedPodcasts), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching trending podcasts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch trending podcasts' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
