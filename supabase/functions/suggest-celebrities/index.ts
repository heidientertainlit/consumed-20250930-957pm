import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from 'https://esm.sh/openai@4.20.1';

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
    const { description } = await req.json();
    
    if (!description || description.length < 3) {
      return new Response(JSON.stringify({ error: 'Please provide a description' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a celebrity matching expert. Given a description of physical traits and personality, suggest 6 celebrities who match. Return ONLY a JSON array of celebrity names, no explanation. Example: ["Tom Hanks", "Jennifer Lawrence", "Keanu Reeves"]`
        },
        {
          role: 'user',
          content: `Find celebrities who match this description: ${description}`
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const responseText = completion.choices[0]?.message?.content || '[]';
    let celebNames: string[] = [];
    
    try {
      celebNames = JSON.parse(responseText.replace(/```json|```/g, '').trim());
    } catch {
      const matches = responseText.match(/"([^"]+)"/g);
      celebNames = matches ? matches.map(m => m.replace(/"/g, '')) : [];
    }

    const celebrities = [];
    for (const name of celebNames.slice(0, 6)) {
      try {
        const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&page=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const person = data.results[0];
          if (person.profile_path) {
            celebrities.push({
              id: String(person.id),
              name: person.name,
              image: `https://image.tmdb.org/t/p/w185${person.profile_path}`,
              known_for: person.known_for?.map((k: any) => k.title || k.name).slice(0, 2).join(', ') || ''
            });
          }
        }
      } catch (e) {
        console.error(`Failed to fetch ${name}:`, e);
      }
    }

    return new Response(JSON.stringify({ celebrities, suggested_names: celebNames }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Suggest celebrities error:', error);
    return new Response(JSON.stringify({ error: 'Failed to suggest celebrities' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
