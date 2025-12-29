import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { item_id, target_list } = await req.json();

    if (!item_id) {
      throw new Error('item_id is required');
    }

    if (!target_list) {
      throw new Error('target_list is required');
    }

    // Map list names to list types for lookup - use ilike patterns for flexible matching
    const listTypeMap: { [key: string]: { title: string; patterns: string[] } } = {
      'currently': { title: 'Currently', patterns: ['Currently%', '%Currently%'] },
      'queue': { title: 'Want To', patterns: ['Want To', 'Queue', '%Want%', '%Queue%'] },
      'finished': { title: 'Finished', patterns: ['Finished', '%Finished%'] },
      'dnf': { title: 'Did Not Finish', patterns: ['Did Not Finish', 'DNF', '%Not Finish%', '%DNF%'] },
      'favorites': { title: 'Favorites', patterns: ['Favorites', '%Favorite%'] }
    };

    const listConfig = listTypeMap[target_list];
    if (!listConfig) {
      throw new Error('Invalid target list');
    }

    // Find the target list for this user - try exact match first, then patterns
    let targetListData = null;
    let listError = null;
    
    // Try exact title match first
    const exactMatch = await supabaseClient
      .from('lists')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', listConfig.title)
      .eq('is_default', true)
      .maybeSingle();
    
    if (exactMatch.data) {
      targetListData = exactMatch.data;
    } else {
      // Try pattern matches
      for (const pattern of listConfig.patterns) {
        const patternMatch = await supabaseClient
          .from('lists')
          .select('id')
          .eq('user_id', user.id)
          .ilike('title', pattern)
          .eq('is_default', true)
          .maybeSingle();
        
        if (patternMatch.data) {
          targetListData = patternMatch.data;
          break;
        }
      }
      
      if (!targetListData) {
        listError = exactMatch.error || { message: 'List not found' };
      }
    }

    if (listError || !targetListData) {
      console.error('Error finding target list:', listError);
      throw new Error(`Target list "${listConfig.title}" not found`);
    }

    // Update the item's list_id
    const { data, error } = await supabaseClient
      .from('list_items')
      .update({ 
        list_id: targetListData.id,
        progress: target_list === 'finished' ? 100 : 0, // Set progress to 100 if finished
        progress_mode: 'percent'
      })
      .eq('id', item_id)
      .eq('user_id', user.id) // Ensure user owns this item
      .select()
      .single();

    if (error) {
      console.error('Error moving item:', error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Move item error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
