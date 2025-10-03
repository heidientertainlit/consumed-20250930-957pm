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

    // GET /pools - List all prediction pools (active or all)
    if (req.method === 'GET' && pathname.endsWith('/pools')) {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      const activeOnly = searchParams.get('active') === '1';

      if (id) {
        // Get single pool
        const { data: pool, error: poolError } = await supabase
          .from('prediction_pools')
          .select('*')
          .eq('id', id)
          .single();

        if (poolError || !pool) {
          return new Response(JSON.stringify({ error: 'Pool not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ pool }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Get all pools
        let query = supabase
          .from('prediction_pools')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (activeOnly) {
          query = query.eq('status', 'open');
        }

        const { data: pools, error: poolsError } = await query;
        if (poolsError) {
          return new Response(JSON.stringify({ error: poolsError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ pools: pools || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /predict - User submits a prediction
    if (req.method === 'POST' && pathname.endsWith('/predict')) {
      const { pool_id, prediction, score } = await req.json();
      
      if (!pool_id || !prediction) {
        return new Response(JSON.stringify({ 
          error: 'pool_id and prediction are required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if pool is still open for predictions
      const { data: pool } = await supabase
        .from('prediction_pools')
        .select('status, points_reward, type, options')
        .eq('id', pool_id)
        .single();

      if (!pool) {
        return new Response(JSON.stringify({ error: 'Pool not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (pool.status !== 'open') {
        return new Response(JSON.stringify({ error: 'Predictions are closed for this pool' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate points based on game type
      let pointsEarned = pool.points_reward;
      
      if (pool.type === 'trivia') {
        // For long-form trivia, use the score passed from frontend
        if (score !== undefined) {
          pointsEarned = score;
        } 
        // For quick trivia (2 options), check if answer is correct
        else if (Array.isArray(pool.options) && pool.options.length === 2 && typeof pool.options[0] === 'string') {
          // Quick trivia - check correct answer stored in options[2] if exists
          const correctAnswer = pool.options[2] || pool.options[0]; // Default to first option if no correct answer stored
          pointsEarned = prediction === correctAnswer ? pool.points_reward : 0;
        }
      }

      // Insert or update user prediction
      const { error: insertError } = await supabase
        .from('user_predictions')
        .upsert({
          user_id: appUser.id,
          pool_id: pool_id,
          prediction: prediction,
          points_earned: pointsEarned,
          created_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id,pool_id',
          ignoreDuplicates: false 
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        points_earned: pointsEarned
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /user-predictions - Get user's predictions
    if (req.method === 'GET' && pathname.endsWith('/user-predictions')) {
      const { searchParams } = new URL(req.url);
      const pool_id = searchParams.get('pool_id');

      let query = supabase
        .from('user_predictions')
        .select('*')
        .eq('user_id', appUser.id);

      if (pool_id) {
        query = query.eq('pool_id', pool_id);
      }

      const { data: userPredictions, error: predictionError } = await query
        .order('created_at', { ascending: false });

      if (predictionError) {
        return new Response(JSON.stringify({ error: predictionError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        user_predictions: userPredictions || [] 
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