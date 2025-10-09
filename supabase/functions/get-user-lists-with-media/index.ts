import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("get-user-lists-with-media function hit!", req.method, req.url);
  
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
    console.log("Auth check result:", { user: user?.email, userError });
    
    let appUser = null;
    if (user && !userError) {
      // Look up app user by email, CREATE if doesn't exist
      let { data: foundAppUser, error: appUserError } = await supabase
        .from('users')
        .select('id, email, user_name')  // FIXED: using user_name instead of username
        .eq('email', user.email)
        .single();

      // If user doesn't exist, create them
      if (appUserError && appUserError.code === 'PGRST116') {
        console.log('User not found, creating new user:', user.email);
        const { data: newUser, error: createError} = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            user_name: user.user_metadata?.user_name || user.email.split('@')[0],
            display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || ''
          })
          .select('id, email, user_name')
          .single();

        if (createError) {
          console.error('Failed to create user:', createError);
          // Continue without user instead of failing
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

    // Get ALL system default lists (user_id = NULL)
    // Create a service role client for accessing system data
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log("Fetching system default lists...");
    const { data: systemLists, error: systemListsError } = await serviceSupabase
      .from('lists')
      .select('id, title')
      .is('user_id', null)
      .order('title');

    console.log("System lists result:", { 
      count: systemLists?.length, 
      systemListsError,
      lists: systemLists?.map(l => l.title)
    });

    if (systemListsError) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch system lists: ' + systemListsError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // SAFE: Fetch custom lists with fallback protection
    let customLists = [];
    if (appUser) {
      try {
        const { data: userLists, error: customListsError } = await supabase
          .from('lists')
          .select('id, title, is_private')
          .eq('user_id', appUser.id)
          .order('title');
        
        if (!customListsError && userLists) {
          customLists = userLists;
          console.log("Custom lists loaded:", customLists.length);
        } else if (customListsError) {
          console.error('Error fetching custom lists (non-fatal):', customListsError);
        }
      } catch (error) {
        console.error('Custom lists query failed (non-fatal):', error);
        // Continue with empty custom lists - system lists will still work
      }
    }

    // Get user's media items if authenticated
    let userItems = [];
    if (appUser) {
      const { data: items, error: itemsError } = await supabase
        .from('list_items')
        .select('id, list_id, title, type, media_type, creator, image_url, notes, created_at, media_id')
        .eq('user_id', appUser.id)
        .order('created_at', { ascending: false });
      
      if (itemsError) {
        console.error('Error fetching user items:', itemsError);
        userItems = [];
      } else {
        userItems = items || [];
      }
      console.log("User items count:", userItems.length);
    }

    // Group items by list_id
    const itemsByListId = userItems.reduce((acc, item) => {
      const listId = item.list_id || 'all';
      if (!acc[listId]) acc[listId] = [];
      acc[listId].push(item);
      return acc;
    }, {});

    // Convert system lists to expected format
    const listsWithItems = (systemLists || []).map(list => ({
      id: list.id,
      title: list.title,
      items: itemsByListId[list.id] || []
    }));

    // Convert custom lists to expected format
    const customListsWithItems = customLists.map(list => ({
      id: list.id,
      title: list.title,
      items: itemsByListId[list.id] || [],
      isCustom: true,
      isPrivate: list.is_private
    }));

    // Add "All" category at the beginning
    const allList = {
      id: 'all',
      title: 'All',
      items: userItems
    };

    // Assemble final lists: All + System Lists + Custom Lists
    const finalLists = [allList, ...listsWithItems, ...customListsWithItems];
    
    console.log("Returning final lists:", finalLists.map(l => `${l.title} (${l.items.length} items)`));

    return new Response(JSON.stringify({ lists: finalLists }), {
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