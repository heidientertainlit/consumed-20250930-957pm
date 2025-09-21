import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization')
          }
        }
      }
    );

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Look up app user by email  
    const { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, user_name, display_name, avatar, email')
      .eq('email', user.email)
      .single();

    if (appUserError || !appUser) {
      return new Response(JSON.stringify({
        error: 'User not found in application database'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Get system default lists (user_id = NULL) - these are the standard lists everyone gets
    const { data: systemLists, error: systemListsError } = await supabase
      .from('lists')
      .select('id, title, description')
      .is('user_id', null)
      .order('title');

    if (systemListsError) {
      console.error('Error fetching system lists:', systemListsError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch system lists'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Get user's media items and group them by list_id
    const { data: userItems, error: itemsError } = await supabase
      .from('list_items')
      .select('id, list_id, title, media_type, creator, image_url, notes, created_at')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error('Error fetching user items:', itemsError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch user items'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Group items by list_id
    const itemsByListId = userItems.reduce((acc: any, item: any) => {
      const listId = item.list_id || 'all'; // NULL list_id becomes 'all'
      if (!acc[listId]) {
        acc[listId] = [];
      }
      acc[listId].push(item);
      return acc;
    }, {});

    // Create lists with their items
    const listsWithItems = systemLists.map((list: any) => ({
      id: list.id,
      title: list.title,
      description: list.description,
      items: itemsByListId[list.id] || []
    }));

    // Add "All" category that includes items with list_id = NULL plus all other items
    const allItems = userItems; // All user items regardless of list
    const allList = {
      id: 'all',
      title: 'All',
      description: 'All tracked media items',
      items: allItems
    };

    return new Response(JSON.stringify({
      lists: [allList, ...listsWithItems]
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Get user lists error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});