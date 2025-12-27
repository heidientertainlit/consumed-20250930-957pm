import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is Level 2+ (Profile or Blueprint)
    const { data: userLevel } = await supabaseClient
      .from('user_dna_levels')
      .select('current_level')
      .eq('user_id', user.id)
      .single();

    if (!userLevel || userLevel.current_level < 2) {
      return new Response(JSON.stringify({ 
        error: 'Celebrity DNA matching requires DNA Profile (Level 2)',
        current_level: userLevel?.current_level || 1,
        required_level: 2
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const celebrityId = url.searchParams.get('celebrity_id');

    // GET: List all celebrities with match scores
    if (req.method === 'GET' && !celebrityId) {
      // Get user's signals
      const { data: userSignals } = await supabaseClient
        .from('user_dna_signals')
        .select('signal_type, signal_value, strength')
        .eq('user_id', user.id);

      if (!userSignals || userSignals.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No DNA signals found. Log some media first.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get all active celebrities
      const { data: celebrities } = await supabaseClient
        .from('celebrity_dna')
        .select('*')
        .eq('is_active', true);

      if (!celebrities || celebrities.length === 0) {
        return new Response(JSON.stringify({ 
          celebrities: [],
          message: 'No celebrity profiles available yet'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate match scores for each celebrity
      const userGenreMap = new Map(
        userSignals
          .filter((s: any) => s.signal_type === 'genre')
          .map((s: any) => [s.signal_value.toLowerCase(), s.strength])
      );
      const userCreatorMap = new Map(
        userSignals
          .filter((s: any) => s.signal_type === 'creator')
          .map((s: any) => [s.signal_value.toLowerCase(), s.strength])
      );
      const userDecadeMap = new Map(
        userSignals
          .filter((s: any) => s.signal_type === 'decade')
          .map((s: any) => [s.signal_value.toLowerCase(), s.strength])
      );

      const celebrityMatches = celebrities.map((celeb: any) => {
        let matchScore = 0;
        let totalWeight = 0;
        const sharedGenres: string[] = [];

        // Compare genre signals
        const celebGenres = celeb.genre_signals || {};
        for (const [genre, celebStrength] of Object.entries(celebGenres)) {
          const userStrength = userGenreMap.get(genre.toLowerCase());
          if (userStrength) {
            const similarity = 1 - Math.abs(Number(userStrength) - Number(celebStrength));
            matchScore += similarity * Number(userStrength);
            totalWeight += Number(userStrength);
            sharedGenres.push(genre);
          }
        }

        // Compare decade signals
        const celebDecades = celeb.decade_signals || {};
        for (const [decade, celebStrength] of Object.entries(celebDecades)) {
          const userStrength = userDecadeMap.get(decade.toLowerCase());
          if (userStrength) {
            const similarity = 1 - Math.abs(Number(userStrength) - Number(celebStrength));
            matchScore += similarity * Number(userStrength) * 0.5;
            totalWeight += Number(userStrength) * 0.5;
          }
        }

        // Compare creator signals
        const celebCreators = celeb.creator_signals || {};
        for (const [creator, celebStrength] of Object.entries(celebCreators)) {
          const userStrength = userCreatorMap.get(creator.toLowerCase());
          if (userStrength) {
            matchScore += Number(userStrength) * 1.5; // Creator matches are weighted higher
            totalWeight += Number(userStrength) * 1.5;
          }
        }

        const normalizedScore = totalWeight > 0 
          ? Math.round((matchScore / totalWeight) * 100)
          : 50;

        return {
          id: celeb.id,
          name: celeb.name,
          image_url: celeb.image_url,
          category: celeb.category,
          dna_title: celeb.dna_title,
          dna_tagline: celeb.dna_tagline,
          match_score: Math.min(99, Math.max(30, normalizedScore)), // Clamp between 30-99
          shared_genres: sharedGenres.slice(0, 3)
        };
      });

      // Sort by match score descending
      celebrityMatches.sort((a: any, b: any) => b.match_score - a.match_score);

      return new Response(JSON.stringify({
        celebrities: celebrityMatches,
        user_level: userLevel.current_level
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET with celebrity_id: Detailed comparison
    if (req.method === 'GET' && celebrityId) {
      const { data: celebrity } = await supabaseClient
        .from('celebrity_dna')
        .select('*')
        .eq('id', celebrityId)
        .eq('is_active', true)
        .single();

      if (!celebrity) {
        return new Response(JSON.stringify({ error: 'Celebrity not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get user's signals and profile
      const [userSignalsRes, userProfileRes] = await Promise.all([
        supabaseClient.from('user_dna_signals').select('*').eq('user_id', user.id),
        supabaseClient.from('dna_profiles').select('label, tagline, flavor_notes').eq('user_id', user.id).single()
      ]);

      const userSignals = userSignalsRes.data || [];
      
      // Calculate detailed comparison
      const sharedGenres: string[] = [];
      const sharedCreators: string[] = [];
      const yourUnique: string[] = [];
      const celebUnique: string[] = [];
      let matchScore = 0;
      let totalWeight = 0;

      const userGenreMap = new Map(
        userSignals.filter((s: any) => s.signal_type === 'genre')
          .map((s: any) => [s.signal_value.toLowerCase(), s.strength])
      );

      // Genre comparison
      const celebGenres = celebrity.genre_signals || {};
      for (const [genre, strength] of Object.entries(celebGenres)) {
        const userStrength = userGenreMap.get(genre.toLowerCase());
        if (userStrength) {
          sharedGenres.push(genre);
          matchScore += Number(userStrength);
          totalWeight += Number(userStrength);
        } else if (Number(strength) > 0.5) {
          celebUnique.push(genre);
        }
      }

      // Find user's unique genres
      for (const [genre, strength] of userGenreMap) {
        const celebGenreLower = Object.keys(celebGenres).map((g: string) => g.toLowerCase());
        if (!celebGenreLower.includes(genre) && Number(strength) > 0.5) {
          yourUnique.push(genre);
        }
      }

      const normalizedScore = totalWeight > 0 
        ? Math.round((matchScore / totalWeight) * 100)
        : 50;

      return new Response(JSON.stringify({
        celebrity: {
          id: celebrity.id,
          name: celebrity.name,
          image_url: celebrity.image_url,
          category: celebrity.category,
          dna_title: celebrity.dna_title,
          dna_tagline: celebrity.dna_tagline,
          traits: celebrity.traits,
          favorite_titles: celebrity.favorite_titles
        },
        your_dna: {
          label: userProfileRes.data?.label,
          tagline: userProfileRes.data?.tagline,
          flavor_notes: userProfileRes.data?.flavor_notes
        },
        match_score: Math.min(99, Math.max(30, normalizedScore)),
        shared_genres: sharedGenres,
        shared_creators: sharedCreators,
        your_unique: yourUnique.slice(0, 5),
        celeb_unique: celebUnique.slice(0, 5),
        compatibility_note: getCompatibilityNote(normalizedScore, celebrity.name)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in match-dna-celebrity:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getCompatibilityNote(score: number, celebName: string): string {
  if (score >= 80) {
    return `You and ${celebName} are entertainment soulmates! 🎬`;
  } else if (score >= 65) {
    return `You and ${celebName} would have great watch party chemistry! 🍿`;
  } else if (score >= 50) {
    return `You and ${celebName} share some common ground in entertainment taste.`;
  } else {
    return `You and ${celebName} have different tastes — but opposites can spark great recommendations!`;
  }
}
