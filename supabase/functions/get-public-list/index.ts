
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
    // Create service role client to bypass RLS for public list access
    const supabase = createClient(
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

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, user_name, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error("User not found:", { userError, userId });
      return new Response(JSON.stringify({ 
        error: 'User not found',
        details: userError?.message || 'No user data returned'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("User found:", { userId: user.id, username: user.user_name });

    // Map list slug to actual list title for filtering
    const slugToTitle = {
      'currently': 'Currently',
      'queue': 'Want To',
      'finished': 'Finished',
      'did-not-finish': 'Did Not Finish',
      'all': 'All'
    };

    const listTitle = slugToTitle[listSlug as keyof typeof slugToTitle];
    if (!listTitle) {
      return new Response(JSON.stringify({ error: 'Invalid list slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Fetching public list "${listTitle}" for user ${userId}`);

    // Get ALL user's items first
    const { data: allItems, error: itemsError } = await supabase
      .from('list_items')
      .select('id, list_id, title, type, media_type, creator, image_url, notes, created_at, media_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error("Failed to fetch user items:", itemsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${allItems?.length || 0} total items for user`);

    let filteredItems = [];

    if (listTitle === 'All') {
      // For "All", return all items
      filteredItems = allItems || [];
    } else {
      // For specific lists, we need to find the system list and filter by it
      const { data: systemList, error: systemListError } = await supabase
        .from('lists')
        .select('id, title')
        .is('user_id', null)
        .eq('title', listTitle)
        .single();

      if (systemListError || !systemList) {
        console.error("System list not found:", { systemListError, listTitle });
        return new Response(JSON.stringify({ 
          error: 'List not found',
          requested_list: listTitle
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log("Found system list:", systemList);

      // Filter items that belong to this list
      filteredItems = (allItems || []).filter(item => item.list_id === systemList.id);
    }

    console.log(`Filtered to ${filteredItems.length} items for list "${listTitle}"`);

    return new Response(JSON.stringify({
      list: {
        id: listTitle.toLowerCase().replace(/\s+/g, '-'),
        title: listTitle,
        items: filteredItems,
        owner: user.user_name || user.email.split('@')[0],
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
