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

    // Service role client for admin operations
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { pathname } = new URL(req.url);
    const segments = pathname.split('/').filter(Boolean);

    // Authentication and user setup (using working pattern)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email, CREATE if doesn't exist (using working pattern)
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
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
        console.error('Failed to create user:', createError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
    } else if (appUserError) {
      console.error('User lookup error:', appUserError);
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Route handling
    switch (req.method) {
      case 'GET':
        if (segments.includes('pools')) {
          return await handleGetPools(supabase, req);
        } else if (segments.includes('predictions')) {
          return await handleGetUserPredictions(supabase, appUser.id, req);
        } else if (segments.includes('leaderboard')) {
          return await handleGetPredictionLeaderboard(serviceSupabase, req);
        } else if (segments.includes('stats')) {
          return await handleGetUserStats(supabase, appUser.id);
        }
        break;

      case 'POST':
        if (segments.includes('predict')) {
          return await handleSubmitPrediction(supabase, appUser.id, req);
        } else if (segments.includes('complete')) {
          return await handleCompletePrediction(serviceSupabase, req);
        }
        break;

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Predictions manager error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Get all prediction pools with user's predictions
async function handleGetPools(supabase: any, req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'open', 'completed', etc.

    let query = supabase
      .from('prediction_pools')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: pools, error: poolsError } = await query;

    if (poolsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch pools' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(pools || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get pools error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get user's predictions
async function handleGetUserPredictions(supabase: any, userId: string, req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const poolId = searchParams.get('pool_id');

    let query = supabase
      .from('user_predictions')
      .select(`
        *,
        prediction_pools:pool_id (
          title,
          description,
          points_reward,
          status,
          icon
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (poolId) {
      query = query.eq('pool_id', poolId);
    }

    const { data: predictions, error: predictionsError } = await query;

    if (predictionsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch predictions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(predictions || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get user predictions error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Submit a prediction
async function handleSubmitPrediction(supabase: any, userId: string, req: Request) {
  try {
    const { pool_id, prediction } = await req.json();

    if (!pool_id || !prediction) {
      return new Response(JSON.stringify({ error: 'pool_id and prediction are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if pool exists and is open
    const { data: pool, error: poolError } = await supabase
      .from('prediction_pools')
      .select('id, status, points_reward')
      .eq('id', pool_id)
      .single();

    if (poolError || !pool) {
      return new Response(JSON.stringify({ error: 'Pool not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (pool.status !== 'open') {
      return new Response(JSON.stringify({ error: 'Pool is not open for predictions' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Upsert user prediction (update if exists, insert if not)
    const { data: userPrediction, error: predictionError } = await supabase
      .from('user_predictions')
      .upsert({
        user_id: userId,
        pool_id: pool_id,
        prediction: prediction,
        points_earned: 0, // Will be updated when pool completes
        is_winner: false
      }, {
        onConflict: 'user_id,pool_id'
      })
      .select()
      .single();

    if (predictionError) {
      console.error('Prediction submission error:', predictionError);
      return new Response(JSON.stringify({ error: 'Failed to submit prediction' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update user stats
    await updateUserPredictionStats(supabase, userId);

    return new Response(JSON.stringify({
      success: true,
      prediction: userPrediction
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Submit prediction error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Complete a prediction pool (admin function)
async function handleCompletePrediction(serviceSupabase: any, req: Request) {
  try {
    const { pool_id, winning_option } = await req.json();

    if (!pool_id || !winning_option) {
      return new Response(JSON.stringify({ error: 'pool_id and winning_option are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pool details
    const { data: pool, error: poolError } = await serviceSupabase
      .from('prediction_pools')
      .select('*')
      .eq('id', pool_id)
      .single();

    if (poolError || !pool) {
      return new Response(JSON.stringify({ error: 'Pool not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark pool as completed
    await serviceSupabase
      .from('prediction_pools')
      .update({ status: 'completed' })
      .eq('id', pool_id);

    // Record the result
    await serviceSupabase
      .from('prediction_results')
      .insert({
        pool_id: pool_id,
        winning_option: winning_option
      });

    // Get all predictions for this pool
    const { data: predictions } = await serviceSupabase
      .from('user_predictions')
      .select('*')
      .eq('pool_id', pool_id);

    // Update winners and award points
    for (const prediction of predictions || []) {
      const isWinner = prediction.prediction === winning_option;
      const pointsEarned = isWinner ? pool.points_reward : 0;

      await serviceSupabase
        .from('user_predictions')
        .update({
          is_winner: isWinner,
          points_earned: pointsEarned
        })
        .eq('id', prediction.id);

      // Update user stats
      await updateUserPredictionStatsService(serviceSupabase, prediction.user_id);
    }

    return new Response(JSON.stringify({
      success: true,
      winners_count: predictions?.filter(p => p.prediction === winning_option).length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Complete prediction error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get prediction leaderboard
async function handleGetPredictionLeaderboard(serviceSupabase: any, req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const timeframe = searchParams.get('timeframe') || 'all_time'; // 'daily', 'weekly', 'all_time'

    // Get user prediction stats joined with user info
    const { data: leaderboard, error: leaderboardError } = await serviceSupabase
      .from('user_prediction_stats')
      .select(`
        *,
        users:user_id (
          user_name,
          email
        )
      `)
      .order('total_points', { ascending: false })
      .order('win_percentage', { ascending: false })
      .limit(limit);

    if (leaderboardError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch leaderboard' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Add rank to each entry
    const rankedLeaderboard = (leaderboard || []).map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

    return new Response(JSON.stringify(rankedLeaderboard), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get user prediction stats
async function handleGetUserStats(supabase: any, userId: string) {
  try {
    const { data: stats, error: statsError } = await supabase
      .from('user_prediction_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsError && statsError.code !== 'PGRST116') {
      return new Response(JSON.stringify({ error: 'Failed to fetch user stats' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return default stats if user has no stats yet
    const userStats = stats || {
      user_id: userId,
      total_predictions: 0,
      total_wins: 0,
      total_points: 0,
      win_percentage: 0.00,
      current_streak: 0,
      best_streak: 0
    };

    return new Response(JSON.stringify(userStats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Update user prediction statistics
async function updateUserPredictionStats(supabase: any, userId: string) {
  try {
    // Get all user predictions
    const { data: predictions } = await supabase
      .from('user_predictions')
      .select('*')
      .eq('user_id', userId);

    if (!predictions) return;

    const totalPredictions = predictions.length;
    const totalWins = predictions.filter(p => p.is_winner).length;
    const totalPoints = predictions.reduce((sum, p) => sum + (p.points_earned || 0), 0);
    const winPercentage = totalPredictions > 0 ? (totalWins / totalPredictions) * 100 : 0;

    // Calculate streaks
    const sortedPredictions = predictions
      .filter(p => p.is_winner !== null) // Only completed predictions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedPredictions.length; i++) {
      if (sortedPredictions[i].is_winner) {
        tempStreak++;
        if (i === 0) currentStreak = tempStreak; // Most recent is winning
      } else {
        if (i === 0) currentStreak = 0; // Most recent is losing
        bestStreak = Math.max(bestStreak, tempStreak);
        tempStreak = 0;
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak);

    // Upsert user stats
    await supabase
      .from('user_prediction_stats')
      .upsert({
        user_id: userId,
        total_predictions: totalPredictions,
        total_wins: totalWins,
        total_points: totalPoints,
        win_percentage: parseFloat(winPercentage.toFixed(2)),
        current_streak: currentStreak,
        best_streak: bestStreak,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

  } catch (error) {
    console.error('Update user stats error:', error);
  }
}

// Service role version of updateUserPredictionStats
async function updateUserPredictionStatsService(serviceSupabase: any, userId: string) {
  try {
    const { data: predictions } = await serviceSupabase
      .from('user_predictions')
      .select('*')
      .eq('user_id', userId);

    if (!predictions) return;

    const totalPredictions = predictions.length;
    const totalWins = predictions.filter(p => p.is_winner).length;
    const totalPoints = predictions.reduce((sum, p) => sum + (p.points_earned || 0), 0);
    const winPercentage = totalPredictions > 0 ? (totalWins / totalPredictions) * 100 : 0;

    const sortedPredictions = predictions
      .filter(p => p.is_winner !== null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedPredictions.length; i++) {
      if (sortedPredictions[i].is_winner) {
        tempStreak++;
        if (i === 0) currentStreak = tempStreak;
      } else {
        if (i === 0) currentStreak = 0;
        bestStreak = Math.max(bestStreak, tempStreak);
        tempStreak = 0;
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak);

    await serviceSupabase
      .from('user_prediction_stats')
      .upsert({
        user_id: userId,
        total_predictions: totalPredictions,
        total_wins: totalWins,
        total_points: totalPoints,
        win_percentage: parseFloat(winPercentage.toFixed(2)),
        current_streak: currentStreak,
        best_streak: bestStreak,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

  } catch (error) {
    console.error('Update user stats service error:', error);
  }
}