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

    console.log('Fetching cached recommendations for user:', user.email);

    // Get cached recommendations
    const { data: cached, error: cacheError } = await supabase
      .from('user_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const now = new Date();

    // If no cache exists, trigger background generation and return empty state
    if (cacheError || !cached) {
      console.log('No cached recommendations found, triggering background generation');
      
      // Trigger background rebuild (fire and forget)
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/rebuild-recommendations`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization') || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.id })
      }).catch(err => console.error('Failed to trigger rebuild:', err));

      return new Response(JSON.stringify({
        success: true,
        recommendations: [],
        isStale: false,
        isGenerating: true,
        message: 'Generating your personalized recommendations...'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if cached recommendations are expired
    const expiresAt = new Date(cached.expires_at);
    const staleAfter = new Date(cached.stale_after);
    const isExpired = now > expiresAt;
    const isStale = now > staleAfter;

    // If expired, trigger rebuild but STILL SERVE old cache (don't leave user with empty state)
    if (isExpired && cached.status !== 'generating') {
      console.log('Cached recommendations expired, triggering rebuild while serving stale cache');
      
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/rebuild-recommendations`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization') || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.id })
      }).catch(err => console.error('Failed to trigger rebuild:', err));

      // Continue to serve the existing cache below with isStale=true flag
    }

    // If stale but not expired, serve cache and trigger background rebuild
    if (isStale && cached.status !== 'generating') {
      console.log('Cached recommendations are stale, triggering background refresh');
      
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/rebuild-recommendations`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization') || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.id })
      }).catch(err => console.error('Failed to trigger rebuild:', err));
    }

    // Return cached recommendations (even if expired - we serve stale data while rebuilding)
    console.log('Serving cached recommendations:', {
      count: cached.recommendations?.recommendations?.length || 0,
      generatedAt: cached.generated_at,
      isStale: isStale || isExpired,
      isExpired
    });

    return new Response(JSON.stringify({
      success: true,
      recommendations: cached.recommendations?.recommendations || [],
      dataSourcesUsed: cached.data_sources_used,
      generatedAt: cached.generated_at,
      expiresAt: cached.expires_at,
      isStale: isStale || isExpired, // Mark as stale if past stale_after OR expired
      isGenerating: cached.status === 'generating',
      model: cached.source_model
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to get recommendations'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
