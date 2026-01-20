import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') || '1e5f6b8fd5c07f4f0eefbe8df62020dc';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, popular } = await req.json();
    
    let url: string;
    if (popular || !query) {
      url = `https://api.themoviedb.org/3/person/popular?api_key=${TMDB_API_KEY}&page=1`;
    } else {
      url = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`;
    }

    const response = await fetch(url);
    const data = await response.json();

    const celebrities = (data.results || [])
      .filter((person: any) => person.profile_path)
      .slice(0, 20)
      .map((person: any) => ({
        id: String(person.id),
        name: person.name,
        image: `https://image.tmdb.org/t/p/w185${person.profile_path}`,
        known_for: person.known_for?.map((k: any) => k.title || k.name).slice(0, 2).join(', ') || '',
        popularity: person.popularity
      }));

    return new Response(JSON.stringify({ celebrities }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Celebrity search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
