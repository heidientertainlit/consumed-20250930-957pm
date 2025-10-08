
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
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source');
    const externalId = searchParams.get('external_id');

    if (!source || !externalId) {
      return new Response(JSON.stringify({ error: 'Missing source or external_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let mediaDetails = null;

    // Fetch from appropriate API based on source
    if (source === 'tmdb') {
      const tmdbKey = Deno.env.get('TMDB_API_KEY');
      
      // Try movie first, then TV
      let response = await fetch(
        `https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`
      );
      
      if (!response.ok) {
        response = await fetch(
          `https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`
        );
      }

      if (response.ok) {
        const data = await response.json();
        mediaDetails = {
          title: data.title || data.name,
          type: data.title ? 'movie' : 'tv',
          creator: data.credits?.crew?.find((c: any) => c.job === 'Director')?.name || 
                   data.created_by?.[0]?.name || 'Unknown',
          image: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
          description: data.overview,
          rating: data.vote_average ? (data.vote_average / 2).toFixed(1) : null,
          releaseDate: data.release_date || data.first_air_date,
          runtime: data.runtime || data.episode_run_time?.[0],
          genres: data.genres?.map((g: any) => g.name) || [],
          cast: data.credits?.cast?.slice(0, 10).map((c: any) => ({
            name: c.name,
            character: c.character,
            profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
          })) || [],
          platforms: data['watch/providers']?.results?.US?.flatrate?.map((p: any) => ({
            name: p.provider_name,
            logo: `https://image.tmdb.org/t/p/w92${p.logo_path}`
          })) || [],
          trailer: data.videos?.results?.find((v: any) => v.type === 'Trailer')?.key
        };
      }
    } else if (source === 'spotify') {
      const spotifyToken = await getSpotifyToken();
      
      // Could be track, album, or show
      let response = await fetch(`https://api.spotify.com/v1/tracks/${externalId}`, {
        headers: { 'Authorization': `Bearer ${spotifyToken}` }
      });

      if (!response.ok) {
        response = await fetch(`https://api.spotify.com/v1/albums/${externalId}`, {
          headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });
      }

      if (!response.ok) {
        response = await fetch(`https://api.spotify.com/v1/shows/${externalId}`, {
          headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });
      }

      if (response.ok) {
        const data = await response.json();
        mediaDetails = {
          title: data.name,
          type: data.type === 'show' ? 'podcast' : 'music',
          creator: data.artists?.[0]?.name || data.publisher || 'Unknown',
          image: data.images?.[0]?.url || data.album?.images?.[0]?.url,
          description: data.description,
          releaseDate: data.release_date,
          duration: data.duration_ms ? Math.floor(data.duration_ms / 60000) : null,
          genres: data.genres || [],
          externalUrl: data.external_urls?.spotify,
          totalTracks: data.total_tracks
        };
      }
    } else if (source === 'openlibrary') {
      const response = await fetch(`https://openlibrary.org/works/${externalId}.json`);
      
      if (response.ok) {
        const data = await response.json();
        const authorResponse = await fetch(`https://openlibrary.org${data.authors?.[0]?.author?.key}.json`);
        const authorData = authorResponse.ok ? await authorResponse.json() : null;

        mediaDetails = {
          title: data.title,
          type: 'book',
          creator: authorData?.name || 'Unknown',
          description: typeof data.description === 'string' ? data.description : data.description?.value,
          subjects: data.subjects?.slice(0, 5) || [],
          firstPublishYear: data.first_publish_date,
          coverUrl: data.covers?.[0] ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg` : null
        };
      }
    }

    if (!mediaDetails) {
      return new Response(JSON.stringify({ error: 'Media not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(mediaDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get media details error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function getSpotifyToken() {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}
