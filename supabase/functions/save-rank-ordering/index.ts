import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const authUserId = authData.user.id;

    let { data: appUser } = await supabaseAdmin
      .from('users').select('id').eq('id', authUserId).maybeSingle();
    if (!appUser) {
      const { data: emailUser } = await supabaseAdmin
        .from('users').select('id').eq('email', authData.user.email).maybeSingle();
      appUser = emailUser;
    }
    if (!appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { rank_id, item_positions } = await req.json();
    // item_positions: Array<{ rank_item_id: string, position: number }>

    if (!rank_id || !Array.isArray(item_positions) || item_positions.length === 0) {
      return new Response(JSON.stringify({ error: 'rank_id and item_positions required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get official positions + current counts
    const { data: officialItems } = await supabaseAdmin
      .from('rank_items')
      .select('id, position, up_vote_count, down_vote_count')
      .eq('rank_id', rank_id);

    if (!officialItems || officialItems.length === 0) {
      return new Response(JSON.stringify({ error: 'No items found for this rank' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const officialMap = new Map(officialItems.map(item => [item.id, item]));

    // Get existing user ordering if any
    const { data: existingOrdering } = await supabaseAdmin
      .from('user_rank_orderings')
      .select('item_positions')
      .eq('rank_id', rank_id)
      .eq('user_id', appUser.id)
      .maybeSingle();

    const oldPositions = new Map<string, number>();
    if (existingOrdering?.item_positions) {
      for (const pos of existingOrdering.item_positions as any[]) {
        oldPositions.set(pos.rank_item_id, pos.position);
      }
    }

    const newPositions = new Map<string, number>();
    for (const pos of item_positions) {
      newPositions.set(pos.rank_item_id, pos.position);
    }

    // Compute deltas: compare user pos vs official pos
    // user pos < official pos → moved up; user pos > official pos → moved down
    const getContribution = (pos: number | undefined, officialPos: number): 'up' | 'down' | 'neutral' => {
      if (pos === undefined) return 'neutral';
      if (pos < officialPos) return 'up';
      if (pos > officialPos) return 'down';
      return 'neutral';
    };

    const updates: Promise<any>[] = [];
    for (const [itemId, official] of officialMap) {
      const officialPos = official.position;
      const oldContrib = getContribution(oldPositions.get(itemId), officialPos);
      const newContrib = getContribution(newPositions.get(itemId), officialPos);

      if (oldContrib !== newContrib) {
        let upDelta = 0;
        let downDelta = 0;
        if (oldContrib === 'up') upDelta--;
        if (oldContrib === 'down') downDelta--;
        if (newContrib === 'up') upDelta++;
        if (newContrib === 'down') downDelta++;

        updates.push(
          supabaseAdmin.from('rank_items').update({
            up_vote_count: Math.max(0, (official.up_vote_count || 0) + upDelta),
            down_vote_count: Math.max(0, (official.down_vote_count || 0) + downDelta)
          }).eq('id', itemId)
        );
      }
    }

    await Promise.all(updates);

    // Upsert user ordering
    await supabaseAdmin.from('user_rank_orderings').upsert({
      rank_id,
      user_id: appUser.id,
      item_positions,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'rank_id,user_id' });

    // Return fresh item counts
    const { data: updatedItems } = await supabaseAdmin
      .from('rank_items')
      .select('id, position, up_vote_count, down_vote_count')
      .eq('rank_id', rank_id)
      .order('position', { ascending: true });

    return new Response(JSON.stringify({ success: true, items: updatedItems || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
