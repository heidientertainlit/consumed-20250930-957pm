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

    // Look up app user by email, CREATE if doesn't exist (matching track-media pattern)
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.email.split('@')[0] || 'user'
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
    } else if (appUserError) {
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { pathname } = new URL(req.url);

    // GET /slates - List all slates (active or all)
    if (req.method === 'GET' && pathname.endsWith('/slates')) {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      const activeOnly = searchParams.get('active') === '1';

      if (id) {
        // Get single slate with predictions
        const { data: slate, error: slateError } = await supabase
          .from('slates')
          .select('*')
          .eq('id', id)
          .single();

        if (slateError || !slate) {
          return new Response(JSON.stringify({ error: 'Slate not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: predictions } = await supabase
          .from('predictions')
          .select('id, slate_id, type, prompt, options, points, status')
          .eq('slate_id', id)
          .order('created_at', { ascending: true });

        return new Response(JSON.stringify({ 
          slate, 
          predictions: predictions || [] 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Get all slates
        let query = supabase
          .from('slates')
          .select('*')
          .order('locks_at', { ascending: true });
        
        if (activeOnly) {
          query = query.eq('is_active', true);
        }

        const { data: slates, error: slatesError } = await query;
        if (slatesError) {
          return new Response(JSON.stringify({ error: slatesError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ slates: slates || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /lock - User submits predictions before lock time
    if (req.method === 'POST' && pathname.endsWith('/lock')) {
      const { slate_id, picks } = await req.json();
      
      if (!slate_id || !Array.isArray(picks) || picks.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'slate_id and picks[] are required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if slate is still open for predictions
      const { data: slate } = await supabase
        .from('slates')
        .select('locks_at')
        .eq('id', slate_id)
        .single();

      if (!slate) {
        return new Response(JSON.stringify({ error: 'Slate not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (new Date() > new Date(slate.locks_at)) {
        return new Response(JSON.stringify({ error: 'Predictions are locked' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate predictions belong to this slate
      const predictionIds = picks.map((p: any) => p.prediction_id);
      const { data: predictions } = await supabase
        .from('predictions')
        .select('id, slate_id, status')
        .in('id', predictionIds);

      const validPredictions = (predictions || []).every(
        p => p.slate_id === slate_id && p.status === 'open'
      );

      if (!validPredictions) {
        return new Response(JSON.stringify({ 
          error: 'Invalid predictions for this slate' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert user picks
      const rows = picks.map((p: any) => ({
        prediction_id: p.prediction_id,
        user_id: appUser.id,
        choice: String(p.choice),
        locked_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('user_picks')
        .upsert(rows, { onConflict: 'user_id,prediction_id' });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /user-picks - Get user's predictions for a slate
    if (req.method === 'GET' && pathname.endsWith('/user-picks')) {
      const { searchParams } = new URL(req.url);
      const slate_id = searchParams.get('slate_id');

      if (!slate_id) {
        return new Response(JSON.stringify({ 
          error: 'slate_id parameter required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: userPicks } = await supabase
        .from('user_picks')
        .select('prediction_id, choice, locked_at, points_awarded')
        .eq('user_id', appUser.id)
        .in('prediction_id', 
          supabase
            .from('predictions')
            .select('id')
            .eq('slate_id', slate_id)
        );

      return new Response(JSON.stringify({ 
        user_picks: userPicks || [] 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Predictions error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});