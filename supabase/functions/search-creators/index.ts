import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { isRelevantCreatorAuthor, rankCreatorSearchResults } from "../_shared/creator-search-ranking.ts";
import { searchPeopleCreatorAuthors } from "../_shared/people-creator-authors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, scope, legacyFollows } = await req.json();
    const peopleCreators = scope === 'people-creators';

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
              popularity: person.popularity || 0,
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
              // Filter out low-quality results (tribute bands, karaoke, etc.)
              const name = artist.name.toLowerCase();
              const isLowQuality = 
                name.includes('tribute') ||
                name.includes('karaoke') ||
                name.includes('piano') ||
                name.includes('cover') ||
                name.includes('- topic') ||
                name.includes('orchestra') ||
                name.includes('instrumental');
              
              // Only include if not low-quality OR if they have significant followers
              if (!isLowQuality || (artist.followers?.total || 0) > 50000) {
                // Safety filter: Don't show ANY Spotify images to avoid inappropriate content
                // Purple placeholder is safer for all musicians
                
                results.push({
                  name: artist.name,
                  role: 'Musician',
                  image: '', // Always purple placeholder for musicians to ensure family-friendly content
                  external_id: artist.id,
                  external_source: 'spotify',
                  genres: artist.genres?.slice(0, 3),
                  followers: artist.followers?.total
                });
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Spotify artist search error:', error);
    }

    // Legacy callers keep Google Books unchanged; People opts into real author identities.
    if (!peopleCreators) {
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
            if (!isRelevantCreatorAuthor(authorName, query)) return;
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
    }

    const authors = peopleCreators ? await searchPeopleCreatorAuthors(query, results, {
      tmdbKey: Deno.env.get('TMDB_API_KEY'),
      googleBooksKey: Deno.env.get('GOOGLE_BOOKS_API_KEY'), legacyFollows,
    }) : null;
    const sortedResults = rankCreatorSearchResults(authors?.results ?? results, query);

    return new Response(JSON.stringify({
      results: sortedResults, ...(authors ? { warnings: authors.warnings } : {}),
    }), {
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
