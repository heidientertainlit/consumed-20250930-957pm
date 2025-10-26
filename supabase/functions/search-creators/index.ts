import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: any[] = [];

    // Search TMDB for people (directors, actors, etc.)
    try {
      const tmdbKey = Deno.env.get('TMDB_API_KEY');
      if (tmdbKey) {
        const tmdbResponse = await fetch(
          `https://api.themoviedb.org/3/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&page=1`
        );
        
        if (tmdbResponse.ok) {
          const tmdbData = await tmdbResponse.json();
          tmdbData.results?.slice(0, 10).forEach((person: any) => {
            // Determine the person's primary role
            let role = 'Actor';
            if (person.known_for_department === 'Directing') {
              role = 'Director';
            } else if (person.known_for_department === 'Writing') {
              role = 'Writer';
            } else if (person.known_for_department === 'Production') {
              role = 'Producer';
            }

            results.push({
              name: person.name,
              role: role,
              image: person.profile_path 
                ? `https://image.tmdb.org/t/p/w185${person.profile_path}` 
                : '',
              external_id: person.id.toString(),
              external_source: 'tmdb',
              known_for: person.known_for?.map((item: any) => item.title || item.name).filter(Boolean).slice(0, 3)
            });
          });
        }
      }
    } catch (error) {
      console.error('TMDB people search error:', error);
    }

    // Search Spotify for artists
    try {
      const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
      const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
      
      if (clientId && clientSecret) {
        // Get access token
        const authResponse = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'grant_type=client_credentials'
        });
        
        if (authResponse.ok) {
          const authData = await authResponse.json();
          const accessToken = authData.access_token;
          
          // Search for artists
          const spotifyResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=10`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            }
          );
          
          if (spotifyResponse.ok) {
            const spotifyData = await spotifyResponse.json();
            spotifyData.artists?.items?.forEach((artist: any) => {
              results.push({
                name: artist.name,
                role: 'Musician',
                image: artist.images?.[0]?.url || '',
                external_id: artist.id,
                external_source: 'spotify',
                genres: artist.genres?.slice(0, 3),
                followers: artist.followers?.total
              });
            });
          }
        }
      }
    } catch (error) {
      console.error('Spotify artist search error:', error);
    }

    // Search Open Library for authors
    try {
      const authorResponse = await fetch(
        `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(query)}&limit=10`
      );
      
      if (authorResponse.ok) {
        const authorData = await authorResponse.json();
        authorData.docs?.forEach((author: any) => {
          results.push({
            name: author.name,
            role: 'Author',
            image: '', // Open Library doesn't provide author images in search
            external_id: author.key,
            external_source: 'openlibrary',
            work_count: author.work_count,
            top_work: author.top_work
          });
        });
      }
    } catch (error) {
      console.error('Open Library author search error:', error);
    }

    // Sort results by relevance (exact matches first, then by popularity)
    const sortedResults = results.sort((a, b) => {
      const queryLower = query.toLowerCase();
      const aNameLower = a.name.toLowerCase();
      const bNameLower = b.name.toLowerCase();
      
      // Exact matches first
      if (aNameLower === queryLower && bNameLower !== queryLower) return -1;
      if (bNameLower === queryLower && aNameLower !== queryLower) return 1;
      
      // Then partial matches starting with query
      if (aNameLower.startsWith(queryLower) && !bNameLower.startsWith(queryLower)) return -1;
      if (bNameLower.startsWith(queryLower) && !aNameLower.startsWith(queryLower)) return 1;
      
      // Then by popularity (Spotify followers, work count, etc.)
      const aPopularity = a.followers || a.work_count || 0;
      const bPopularity = b.followers || b.work_count || 0;
      return bPopularity - aPopularity;
    });

    return new Response(JSON.stringify({ results: sortedResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Creator search error:', error);
    return new Response(JSON.stringify({ error: error.message, results: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
