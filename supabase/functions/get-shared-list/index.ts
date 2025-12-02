import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("get-shared-list function hit!", req.method, req.url);
  
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

    // Parse request body to get list_id or extract from URL
    let listId;
    if (req.method === 'POST') {
      const requestBody = await req.json();
      listId = requestBody.list_id;
    } else {
      // Handle GET request with list_id in URL params
      const url = new URL(req.url);
      listId = url.searchParams.get('list_id');
    }

    if (!listId) {
      return new Response(JSON.stringify({ error: 'list_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Looking for list with ID:', listId);

    // Get auth user (may be null for unauthenticated users)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Auth check result:', { user: user?.email, userError });
    
    let appUser = null;
    if (user && !userError) {
      // Look up app user by email, CREATE if doesn't exist
      let { data: foundAppUser, error: appUserError } = await supabase
        .from('users')
        .select('id, email, user_name')
        .eq('email', user.email)
        .single();

      // If user doesn't exist, create them
      if (appUserError && appUserError.code === 'PGRST116') {
        console.log('User not found, creating new user:', user.email);
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
            display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || ''
          })
          .select('id, email, user_name')
          .single();

        if (createError) {
          console.error('Failed to create user:', createError);
          appUser = null;
        } else {
          appUser = newUser;
          console.log('Created new user:', appUser);
        }
      } else if (!appUserError) {
        appUser = foundAppUser;
        console.log("App user lookup:", { appUser: appUser?.email });
      }
    }

    // For system lists, convert URL slug back to title and find by title
    const systemListMapping = {
      'currently': 'Currently',
      'queue': 'Want To', 
      'finished': 'Finished',
      'did-not-finish': 'Did Not Finish'
    };

    let listData = null;

    // First try to find system list by mapping the slug
    if (systemListMapping[listId]) {
      console.log('Looking for system list:', systemListMapping[listId]);
      
      const { data: systemList, error: systemError } = await supabase
        .from('lists')
        .select('id, title, user_id')
        .is('user_id', null)
        .eq('title', systemListMapping[listId])
        .single();

      if (!systemError && systemList) {
        listData = systemList;
        console.log('Found system list:', listData);
      }
    }

    // If not found as system list, try to find by actual ID
    if (!listData) {
      console.log('Looking for list by ID:', listId);
      
      const { data: list, error: listError } = await supabase
        .from('lists')
        .select('id, title, user_id, is_public')
        .eq('id', listId)
        .single();

      if (listError || !list) {
        console.error('List not found:', listError);
        return new Response(JSON.stringify({ error: 'List not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      listData = list;
    }

    // Authorization check for non-system lists
    if (listData.user_id !== null) {
      // This is a user-created list, check permissions
      const isOwner = appUser && listData.user_id === appUser.id;
      
      // For now, only allow access to public lists or owner's lists
      // TODO: Add collaborator support when that feature is implemented
      if (!listData.is_public && !isOwner) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Get list items
    let listItems = [];
    if (appUser) {
      const { data: items, error: itemsError } = await supabase
        .from('list_items')
        .select('id, list_id, title, type, media_type, creator, image_url, notes, created_at, media_id')
        .eq('user_id', appUser.id)
        .eq('list_id', listData.id)
        .order('created_at', { ascending: false });
      
      if (!itemsError && items) {
        listItems = items;
      }
    }

    const response = {
      id: listData.id,
      title: listData.title,
      user_id: listData.user_id,
      is_public: listData.is_public || (listData.user_id === null), // System lists are always public
      items: listItems
    };

    console.log('Returning list data:', { 
      title: response.title, 
      itemCount: response.items.length,
      isSystemList: listData.user_id === null
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get shared list error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});