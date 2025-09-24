import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("get-public-list function hit!", req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create service role client for accessing all data
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse URL parameters
    const url = new URL(req.url);
    const listSlug = url.searchParams.get('list_slug');
    const userId = url.searchParams.get('user_id');

    console.log("Parameters:", { listSlug, userId });

    if (!listSlug || !userId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters: list_slug and user_id' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Map list slug to actual list title
    const slugToTitle = {
      'currently': 'Currently',
      'queue': 'Queue',
      'finished': 'Finished',
      'did-not-finish': 'Did Not Finish'
    };

    const listTitle = slugToTitle[listSlug as keyof typeof slugToTitle];
    if (!listTitle) {
      return new Response(JSON.stringify({ error: 'Invalid list slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Fetching public list "${listTitle}" for user ${userId}`);
    
    // Check if user exists - using correct column name 'username'
    const { data: user, error: userError } = await serviceSupabase
      .from('users')
      .select('id, username, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error("User not found:", userError);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the specific list for this user - checking against system lists
    const { data: list, error: listError } = await serviceSupabase
      .from('lists')
      .select('id, title, is_private, user_id')
      .eq('title', listTitle)
      .is('user_id', null) // System lists have user_id = null
      .single();

    if (listError || !list) {
      console.error("System list not found:", listError);
      return new Response(JSON.stringify({ error: 'List not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Found system list:", list);

    // Get user's items from this list - using correct column name 'added_at'
    const { data: items, error: itemsError } = await serviceSupabase
      .from('list_items')
      .select('id, title, type, media_type, creator, image_url, notes, added_at, media_id')
      .eq('list_id', list.id)
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (itemsError) {
      console.error("Failed to fetch list items:", itemsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch list items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found public list with ${items?.length || 0} items`);

    // Convert to expected format with created_at for frontend compatibility
    const formattedItems = (items || []).map(item => ({
      ...item,
      created_at: item.added_at // Frontend expects created_at
    }));

    return new Response(JSON.stringify({
      list: {
        id: list.id,
        title: list.title,
        items: formattedItems,
        owner: user.username || user.email.split('@')[0],
        is_private: false // All lists are public for MVP
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error: ' + error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});