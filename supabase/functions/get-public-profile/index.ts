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
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user points
    const { data: pointsData } = await supabase
      .from('user_points')
      .select('total_points')
      .eq('user_id', userId)
      .single();

    // Get global rank
    const { data: rankData } = await supabase.rpc('get_user_rank', { target_user_id: userId });

    // Get items logged count
    const { count: itemsLogged } = await supabase
      .from('media_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get currently consuming items (from "Currently" list)
    const { data: currentlyList } = await supabase
      .from('user_lists')
      .select('id')
      .eq('user_id', userId)
      .eq('name', 'Currently')
      .single();

    let currentlyConsuming: any[] = [];
    if (currentlyList?.id) {
      const { data: listItems } = await supabase
        .from('list_items')
        .select('title, image_url, media_type')
        .eq('list_id', currentlyList.id)
        .order('created_at', { ascending: false })
        .limit(6);
      
      currentlyConsuming = listItems || [];
    }

    // Get most consumed media types
    const { data: mediaTypeCounts } = await supabase
      .from('media_history')
      .select('media_type')
      .eq('user_id', userId);

    const typeCounts: Record<string, number> = {};
    (mediaTypeCounts || []).forEach((item: any) => {
      const type = item.media_type || 'other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const sortedTypes = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([type]) => type.charAt(0).toUpperCase() + type.slice(1));

    // Get DNA profile
    const { data: dnaProfile } = await supabase
      .from('dna_profiles')
      .select('label, tagline')
      .eq('user_id', userId)
      .single();

    const publicProfile = {
      id: profile.id,
      display_name: profile.display_name,
      username: profile.username,
      avatar_url: profile.avatar_url,
      total_points: pointsData?.total_points || 0,
      items_logged: itemsLogged || 0,
      global_rank: rankData || null,
      mostly_into: sortedTypes,
      currently_consuming: currentlyConsuming,
      dna_label: dnaProfile?.label || null,
      dna_tagline: dnaProfile?.tagline || null,
    };

    return new Response(
      JSON.stringify(publicProfile),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching public profile:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
