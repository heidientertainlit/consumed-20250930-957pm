import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json();
    const { query, type } = body;
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({
        results: []
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Media search request:', {
      query,
      type
    });
    const results = [];
    // Search movies and TV shows via TMDB
    if (!type || type === 'movie' || type === 'tv') {
      try {
        const tmdbKey = Deno.env.get('TMDB_API_KEY');
        if (tmdbKey) {
          // Multi search endpoint for movies and TV
          const tmdbResponse = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&page=1`);
          if (tmdbResponse.ok) {
            const tmdbData = await tmdbResponse.json();
            tmdbData.results?.slice(0, 10).forEach((item)=>{
              if (item.media_type === 'movie' || item.media_type === 'tv') {
                results.push({
                  title: item.title || item.name,
                  type: item.media_type === 'movie' ? 'movie' : 'tv',
                  creator: item.media_type === 'movie' ? 'Unknown' : 'TV Show',
                  image: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
                  external_id: item.id?.toString(),
                  external_source: 'tmdb',
                  description: item.overview
                });
              }
            });
          }
        }
      } catch (error) {
        console.error('TMDB search error:', error);
      }
    }
    // Search books via Open Library
    if (!type || type === 'book') {
      try {
        const bookResponse = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`);
        if (bookResponse.ok) {
          const bookData = await bookResponse.json();
          bookData.docs?.slice(0, 5).forEach((book)=>{
            results.push({
              title: book.title,
              type: 'book',
              creator: book.author_name?.[0] || 'Unknown Author',
              image: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : '',
              external_id: book.key,
              external_source: 'openlibrary',
              description: book.first_sentence?.[0] || ''
            });
          });
        }
      } catch (error) {
        console.error('Books search error:', error);
      }
    }
    // Search YouTube videos (limited results without API key)
    if (!type || type === 'youtube') {
      // Add some mock YouTube results for now
      if (query.toLowerCase().includes('office')) {
        results.push({
          title: 'The Office - Best Cold Opens',
          type: 'youtube',
          creator: 'The Office',
          image: '',
          external_id: 'mock-video-1',
          external_source: 'youtube',
          description: 'Compilation of the best cold opens from The Office'
        });
      }
    }
    // Search podcasts (mock data for now - return results for any query)
    if (!type || type === 'podcast') {
      // Return relevant podcast results for any search query
      if (query.toLowerCase().includes('aspire') || query.toLowerCase().includes('entrepreneur') || query.toLowerCase().includes('business')) {
        results.push({
          title: 'How I Built This',
          type: 'podcast',
          creator: 'NPR',
          image: '',
          external_id: 'mock-podcast-aspire-1',
          external_source: 'spotify',
          description: 'Stories behind the companies you know'
        });
        results.push({
          title: 'The Tim Ferriss Show',
          type: 'podcast',
          creator: 'Tim Ferriss',
          image: '',
          external_id: 'mock-podcast-aspire-2',
          external_source: 'spotify',
          description: 'Deconstructing world-class performers'
        });
      } else {
        // Default podcast results for other queries
        results.push({
          title: 'The Joe Rogan Experience',
          type: 'podcast',
          creator: 'Joe Rogan',
          image: '',
          external_id: 'mock-podcast-1',
          external_source: 'spotify',
          description: 'Long form conversations'
        });
        results.push({
          title: 'Serial',
          type: 'podcast',
          creator: 'Sarah Koenig',
          image: '',
          external_id: 'mock-podcast-2',
          external_source: 'spotify',
          description: 'Investigative journalism podcast'
        });
      }
    }
    // Search music (mock data for now)
    if (!type || type === 'music') {
      if (query.toLowerCase().includes('taylor') || query.toLowerCase().includes('swift')) {
        results.push({
          title: 'Anti-Hero',
          type: 'music',
          creator: 'Taylor Swift',
          image: '',
          external_id: 'mock-song-1',
          external_source: 'spotify',
          description: 'From the album Midnights'
        });
      }
    }
    console.log(`Found ${results.length} results for query: ${query}`);
    return new Response(JSON.stringify({
      results
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Media search error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});