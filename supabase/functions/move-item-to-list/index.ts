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

    // Look up app user by email (same pattern as other edge functions)
    let appUser = null;
    const { data: appUserData, error: appUserError } = await supabaseClient
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      // User not found - this shouldn't happen for existing items
      throw new Error('User not found');
    } else if (appUserError) {
      throw new Error('User lookup failed: ' + appUserError.message);
    }
    
    appUser = appUserData;
    const userId = appUser.id;

    const { item_id, target_list, client_event_id, event_id, idempotency_key } = await req.json();
    const clientEventId = client_event_id ?? event_id ?? idempotency_key ?? null;

    if (!item_id) {
      throw new Error('item_id is required');
    }

    if (!target_list) {
      throw new Error('target_list is required');
    }
    if (clientEventId !== null &&
      (typeof clientEventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientEventId))) {
      throw new Error('client_event_id must be a UUID');
    }

    // Map list names to list types for lookup - use ilike patterns for flexible matching
    const listTypeMap: { [key: string]: { title: string; patterns: string[] } } = {
      'currently': { title: 'Currently', patterns: ['Currently%', '%Currently%'] },
      'queue': { title: 'Want To', patterns: ['Want To', '%Want%'] },
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
      .eq('user_id', userId)
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
          .eq('user_id', userId)
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

    // The RPC checks receipts before it looks up the source item, so a retry
    // still succeeds after a duplicate-target move deleted that source row.
    const { data: moveResult, error } = await supabaseClient.rpc('move_list_item_with_completion', {
      p_item_id: item_id,
      p_target_list_id: targetListData.id,
      p_mark_completed: target_list === 'finished',
      p_client_event_id: clientEventId,
    });

    if (error) {
      console.error('Error moving item:', error);
      throw error;
    }
    const data = moveResult?.data ?? moveResult;
    if (moveResult?.already_in_target) {
      return new Response(JSON.stringify({ success: true, message: 'Item already in target list', data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
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
