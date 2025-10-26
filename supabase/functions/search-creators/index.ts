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

    // Search Google Books for authors
    try {
      const googleBooksKey = Deno.env.get('GOOGLE_BOOKS_API_KEY');
      const authorQuery = `inauthor:${encodeURIComponent(query)}`;
      const booksUrl = googleBooksKey 
        ? `https://www.googleapis.com/books/v1/volumes?q=${authorQuery}&maxResults=10&key=${googleBooksKey}`
        : `https://www.googleapis.com/books/v1/volumes?q=${authorQuery}&maxResults=10`;
      
      const booksResponse = await fetch(booksUrl);
      
      if (booksResponse.ok) {
        const booksData = await booksResponse.json();
        const authorMap = new Map();
        
        // Extract unique authors from book results
        booksData.items?.forEach((book: any) => {
          const authors = book.volumeInfo?.authors || [];
          authors.forEach((authorName: string) => {
            // Trust Google Books relevance - they already filtered by inauthor:query
            if (!authorMap.has(authorName)) {
              authorMap.set(authorName, {
                name: authorName,
                role: 'Author',
                image: book.volumeInfo?.imageLinks?.thumbnail || '',
                external_id: book.id,
                external_source: 'googlebooks',
                work_count: 1,
                sample_book: book.volumeInfo?.title
              });
            } else {
              // Increment work count for duplicate authors
              const existing = authorMap.get(authorName);
              existing.work_count++;
            }
          });
        });
        
        // Add unique authors to results
        authorMap.forEach((author) => {
          results.push(author);
        });
      }
    } catch (error) {
      console.error('Google Books author search error:', error);
    }

    // Deduplicate by name, keeping the most relevant/popular entry
    const deduplicatedMap = new Map();
    
    results.forEach((creator) => {
      const nameLower = creator.name.toLowerCase();
      
      if (!deduplicatedMap.has(nameLower)) {
        deduplicatedMap.set(nameLower, creator);
      } else {
        const existing = deduplicatedMap.get(nameLower);
        
        // Prefer entries with images
        if (creator.image && !existing.image) {
          deduplicatedMap.set(nameLower, creator);
        }
        // If both have images or neither do, prefer by popularity
        else if ((creator.image && existing.image) || (!creator.image && !existing.image)) {
          const creatorPopularity = creator.followers || creator.work_count || 0;
          const existingPopularity = existing.followers || existing.work_count || 0;
          
          if (creatorPopularity > existingPopularity) {
            deduplicatedMap.set(nameLower, creator);
          }
        }
      }
    });
    
    // Convert map back to array
    const deduplicatedResults = Array.from(deduplicatedMap.values());
    
    // Sort results by relevance (exact matches first, then by popularity)
    const sortedResults = deduplicatedResults.sort((a, b) => {
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
