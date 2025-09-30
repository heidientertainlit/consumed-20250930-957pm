import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get custom user_id from users table using auth.users.id
    const { data: customUser, error: customUserError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (customUserError || !customUser) {
      return new Response(JSON.stringify({ error: 'User not found in custom users table' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = customUser.id;

    // Get all list items for this user
    const { data: listItems, error: listItemsError } = await supabase
      .from('list_items')
      .select('creator, media_type')
      .eq('user_id', userId);

    if (listItemsError) {
      throw listItemsError;
    }

    if (!listItems || listItems.length === 0) {
      return new Response(JSON.stringify({ message: 'No media tracked yet', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Aggregate creator stats
    const creatorStats: Record<string, { fan_points: number; media_types: string[] }> = {};

    for (const item of listItems) {
      const creator = item.creator || 'Unknown';
      const mediaType = item.media_type || 'unknown';

      if (!creatorStats[creator]) {
        creatorStats[creator] = { fan_points: 0, media_types: [] };
      }

      creatorStats[creator].fan_points += 1;
      if (!creatorStats[creator].media_types.includes(mediaType)) {
        creatorStats[creator].media_types.push(mediaType);
      }
    }

    // Delete existing stats for this user (using service role for full access)
    await supabase
      .from('user_creator_stats')
      .delete()
      .eq('user_id', userId);

    // Insert new aggregated stats
    const statsToInsert = Object.entries(creatorStats).map(([creator, stats]) => ({
      user_id: userId,
      creator_name: creator,
      fan_points: stats.fan_points,
      media_types: stats.media_types,
    }));

    const { error: insertError } = await supabase
      .from('user_creator_stats')
      .insert(statsToInsert);

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        message: 'Creator stats synced successfully',
        synced: statsToInsert.length,
        stats: statsToInsert,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error syncing creator stats:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
