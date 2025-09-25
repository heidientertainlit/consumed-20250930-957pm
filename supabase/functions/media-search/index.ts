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
    const body = await req.json();
    const { query, type } = body;
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Media search:', { query, type });
    const results = [];

    // SIMPLIFIED MOCK DATA FOR NOW - UNTIL API KEYS WORK
    if (!type || type === 'movie') {
      if (query.toLowerCase().includes('aspire') || query.toLowerCase().includes('pursuit')) {
        results.push({
          title: 'The Pursuit of Happyness',
          type: 'movie',
          creator: 'Gabriele Muccino',
          image: '',
          external_id: 'mock-movie-1',
          external_source: 'tmdb',
          description: 'Inspiring story of determination and success'
        });
      }
    }

    if (!type || type === 'tv') {
      if (query.toLowerCase().includes('aspire') || query.toLowerCase().includes('office')) {
        results.push({
          title: 'The Office',
          type: 'tv',
          creator: 'Greg Daniels',
          image: '',
          external_id: 'mock-tv-1',
          external_source: 'tmdb',
          description: 'Comedy series about office life'
        });
      }
    }

    if (!type || type === 'podcast') {
      if (query.toLowerCase().includes('aspire') || query.toLowerCase().includes('business') || query.toLowerCase().includes('entrepreneur')) {
        results.push({
          title: 'How I Built This',
          type: 'podcast',
          creator: 'NPR',
          image: '',
          external_id: 'mock-podcast-1',
          external_source: 'spotify',
          description: 'Stories behind successful companies'
        });
        results.push({
          title: 'The Tim Ferriss Show',
          type: 'podcast',
          creator: 'Tim Ferriss',
          image: '',
          external_id: 'mock-podcast-2',
          external_source: 'spotify',
          description: 'Conversations with world-class performers'
        });
      }
    }

    if (!type || type === 'book') {
      if (query.toLowerCase().includes('aspire') || query.toLowerCase().includes('success')) {
        results.push({
          title: 'The 7 Habits of Highly Effective People',
          type: 'book',
          creator: 'Stephen Covey',
          image: '',
          external_id: 'mock-book-1',
          external_source: 'openlibrary',
          description: 'Personal development classic'
        });
      }
    }

    console.log(`Returning ${results.length} results for "${query}"`);
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
