
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const { query } = await req.json();

      if (!query || query.trim().length === 0) {
        return new Response(JSON.stringify({
          type: 'error',
          message: 'Please enter a search query'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Simple conversational search implementation
      // In a real app, this would use AI/LLM to understand the query
      const lowercaseQuery = query.toLowerCase();

      // Check if it's a recommendation request
      if (lowercaseQuery.includes('recommend') || lowercaseQuery.includes('like') || lowercaseQuery.includes('similar')) {
        return new Response(JSON.stringify({
          type: 'conversational',
          explanation: `Based on your query "${query}", here are some personalized recommendations:`,
          recommendations: [
            {
              title: "The Crown",
              type: "tv",
              description: "A historical drama series about the British royal family",
              searchTerm: "The Crown"
            },
            {
              title: "Succession",
              type: "tv", 
              description: "A dark comedy-drama about a media empire family",
              searchTerm: "Succession"
            },
            {
              title: "The Queen's Gambit",
              type: "tv",
              description: "A coming-of-age story about a chess prodigy",
              searchTerm: "The Queen's Gambit"
            }
          ],
          searchSuggestions: [
            "Drama series with complex characters",
            "Period dramas",
            "Award-winning TV shows"
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if it's a direct search
      if (lowercaseQuery.includes('christopher nolan') || lowercaseQuery.includes('taylor swift') || lowercaseQuery.includes('marvel')) {
        return new Response(JSON.stringify({
          type: 'direct',
          results: [
            {
              id: "1",
              title: "Inception",
              type: "movie",
              description: "A mind-bending thriller about dreams within dreams",
              year: 2010,
              rating: 8.8,
              poster_url: "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg"
            },
            {
              id: "2", 
              title: "Interstellar",
              type: "movie",
              description: "A space epic about humanity's survival",
              year: 2014,
              rating: 8.6,
              poster_url: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
            }
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Default conversational response
      return new Response(JSON.stringify({
        type: 'conversational',
        explanation: `I understand you're looking for "${query}". Here are some suggestions:`,
        recommendations: [
          {
            title: "Popular on consumed",
            type: "various",
            description: "Check out what other users are currently enjoying",
            searchTerm: "trending"
          }
        ],
        searchSuggestions: [
          "Movies like Inception",
          "TV shows similar to Breaking Bad",
          "Books by Stephen King",
          "Taylor Swift discography"
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Conversational search error:', error);
    return new Response(JSON.stringify({
      type: 'error',
      message: 'Search is temporarily unavailable. Please try again later.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
