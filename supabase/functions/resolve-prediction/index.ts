import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { pool_id, winning_option, resolved_by = 'creator' } = await req.json();

    if (!pool_id || !winning_option) {
      return new Response(JSON.stringify({ 
        error: 'pool_id and winning_option are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use admin client for resolution operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the pool
    const { data: pool, error: poolError } = await supabaseAdmin
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

    // Verify user is authorized to resolve (creator of user-generated predictions)
    // Consumed predictions can be resolved by anyone (for backward compatibility)
    if (pool.origin_type === 'user' && pool.origin_user_id !== user.id) {
      return new Response(JSON.stringify({ 
        error: 'Only the creator can resolve this prediction' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update pool status to completed
    const { error: updatePoolError } = await supabaseAdmin
      .from('prediction_pools')
      .update({
        status: 'completed',
        resolved_at: new Date().toISOString(),
        resolved_by: resolved_by
      })
      .eq('id', pool_id);

    if (updatePoolError) {
      console.error('Error updating pool:', updatePoolError);
      return new Response(JSON.stringify({ error: updatePoolError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert into prediction_results
    const { error: resultError } = await supabaseAdmin
      .from('prediction_results')
      .insert({
        pool_id: pool_id,
        winning_option: winning_option,
        completed_at: new Date().toISOString()
      });

    if (resultError) {
      console.error('Error inserting result:', resultError);
    }

    // Get all user predictions for this pool
    const { data: userPredictions, error: predsError } = await supabaseAdmin
      .from('user_predictions')
      .select('*')
      .eq('pool_id', pool_id);

    if (predsError) {
      console.error('Error fetching predictions:', predsError);
      return new Response(JSON.stringify({ error: predsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Award points: +20 for correct, -5 for incorrect
    const updates = [];
    const statsUpdates = new Map(); // Track stats per user

    for (const pred of userPredictions || []) {
      const isCorrect = pred.prediction === winning_option;
      const pointsAwarded = isCorrect ? 20 : -5;

      // Update user_predictions with points and winner status
      updates.push(
        supabaseAdmin
          .from('user_predictions')
          .update({
            points_earned: pointsAwarded,
            is_winner: isCorrect
          })
          .eq('id', pred.id)
      );

      // Track stats updates
      if (!statsUpdates.has(pred.user_id)) {
        statsUpdates.set(pred.user_id, {
          user_id: pred.user_id,
          wins: 0,
          total: 0
        });
      }
      const userStats = statsUpdates.get(pred.user_id);
      userStats.total += 1;
      if (isCorrect) userStats.wins += 1;
    }

    // Execute all prediction updates
    await Promise.all(updates);

    // Update user_prediction_stats for each user
    for (const [userId, stats] of statsUpdates) {
      const { data: existingStats } = await supabaseAdmin
        .from('user_prediction_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingStats) {
        const newTotalWins = (existingStats.total_wins || 0) + stats.wins;
        const newTotalPredictions = (existingStats.total_predictions || 0) + stats.total;
        const newTotalPoints = (existingStats.total_points || 0) + (stats.wins * 20 - (stats.total - stats.wins) * 5);
        const winPercentage = newTotalPredictions > 0 ? (newTotalWins / newTotalPredictions) * 100 : 0;

        // Update streak
        let newCurrentStreak = existingStats.current_streak || 0;
        if (stats.wins > 0) {
          newCurrentStreak += stats.wins;
        } else {
          newCurrentStreak = 0; // Reset streak on loss
        }
        const newBestStreak = Math.max(existingStats.best_streak || 0, newCurrentStreak);

        await supabaseAdmin
          .from('user_prediction_stats')
          .update({
            total_predictions: newTotalPredictions,
            total_wins: newTotalWins,
            total_points: newTotalPoints,
            win_percentage: winPercentage,
            current_streak: newCurrentStreak,
            best_streak: newBestStreak,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      } else {
        // Create new stats entry
        const totalPoints = stats.wins * 20 - (stats.total - stats.wins) * 5;
        const winPercentage = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;

        await supabaseAdmin
          .from('user_prediction_stats')
          .insert({
            user_id: userId,
            total_predictions: stats.total,
            total_wins: stats.wins,
            total_points: totalPoints,
            win_percentage: winPercentage,
            current_streak: stats.wins,
            best_streak: stats.wins,
            updated_at: new Date().toISOString()
          });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      winning_option: winning_option,
      users_updated: statsUpdates.size
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Resolve prediction error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
