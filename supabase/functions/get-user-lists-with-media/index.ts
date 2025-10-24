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
        
        // Use service role to create user and lists
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const { data: newUser, error: createError} = await supabaseAdmin
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
          
          // Create personal system lists for new user (idempotent)
          const systemLists = [
            'Currently',
            'Queue',
            'Finished',
            'Did Not Finish',
            'Favorites'
          ];

          // Use individual inserts with error handling for idempotency
          for (const listTitle of systemLists) {
            const { error: listError } = await supabaseAdmin
              .from('lists')
              .insert({
                user_id: newUser.id,
                title: listTitle,
                is_default: true,
                is_private: false
              })
              .select('id, title, is_default, is_private')
              .maybeSingle();
            
            // Ignore duplicate key errors (23505), fail on others
            if (listError && listError.code !== '23505') {
              console.error(`Failed to create ${listTitle} list:`, listError);
              return new Response(JSON.stringify({ 
                error: `Failed to create system list ${listTitle}: ${listError.message}`,
                lists: []
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
          console.log('Created personal system lists for new user');
        }
      } else if (!appUserError) {
        appUser = foundAppUser;
        console.log("App user lookup:", { appUser: appUser?.email });
      }
    }

    // Get user_id from query parameter (for viewing other users) or use logged-in user
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id') || appUser?.id;

    // Get user's personal system lists (is_default = true) and custom lists
    let systemLists = [];
    let customLists = [];
    
    if (targetUserId) {
      // Check if user has personal system lists
      const { data: userSystemLists, error: systemListsError } = await supabase
        .from('lists')
        .select('id, title, is_private')
        .eq('user_id', targetUserId)
        .eq('is_default', true)
        .order('title');

      console.log("User system lists result:", { 
        count: userSystemLists?.length, 
        systemListsError,
        lists: userSystemLists?.map(l => l.title)
      });

      // FILTER: Only include the 5 standard system lists, exclude old duplicates
      const requiredSystemLists = [
        'Currently',
        'Queue',
        'Finished',
        'Did Not Finish',
        'Favorites'
      ];

      // Filter to only include standard system lists (ignore old lists like "Completed", "Currently Watching", etc.)
      const filteredSystemLists = (userSystemLists || []).filter(list => 
        requiredSystemLists.includes(list.title)
      );

      const existingTitles = new Set(filteredSystemLists.map(l => l.title));
      const missingLists = requiredSystemLists.filter(title => !existingTitles.has(title));

      if (missingLists.length > 0) {
        console.log(`Auto-migration: Backfilling ${missingLists.length} missing system lists`);
        
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Create missing lists individually with error handling
        for (const listTitle of missingLists) {
          const { error: listError } = await supabaseAdmin
            .from('lists')
            .insert({
              user_id: appUser.id,
              title: listTitle,
              is_default: true,
              is_private: false
            })
            .select('id, title, is_default, is_private')
            .maybeSingle();
          
          // Ignore duplicate key errors (23505), fail on others
          if (listError && listError.code !== '23505') {
            console.error(`Failed to backfill ${listTitle} list:`, listError);
            return new Response(JSON.stringify({ 
              error: `Failed to backfill system list ${listTitle}: ${listError.message}`,
              lists: []
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Re-fetch and filter system lists after backfill
        const { data: updatedSystemLists } = await supabase
          .from('lists')
          .select('id, title, is_private')
          .eq('user_id', targetUserId)
          .eq('is_default', true)
          .order('title');
        
        // Filter again to only include standard lists
        systemLists = (updatedSystemLists || []).filter(list => 
          requiredSystemLists.includes(list.title)
        );
        console.log('System lists after backfill:', systemLists.length);
      } else {
        systemLists = filteredSystemLists;
      }

      // Fetch custom lists (is_default = false or null)
      try {
        const { data: userCustomLists, error: customListsError } = await supabase
          .from('lists')
          .select('id, title, is_private')
          .eq('user_id', targetUserId)
          .or('is_default.is.null,is_default.eq.false')
          .order('title');
        
        if (!customListsError && userCustomLists) {
          customLists = userCustomLists;
          console.log("Custom lists loaded:", customLists.length);
        } else if (customListsError) {
          console.error('Error fetching custom lists (non-fatal):', customListsError);
        }
      } catch (error) {
        console.error('Custom lists query failed (non-fatal):', error);
      }

      // Fetch collaborative lists (lists where user is a collaborator)
      if (appUser?.id) {
        try {
          const { data: collaborativeLists, error: collabError } = await supabase
            .from('list_collaborators')
            .select('list_id, lists!inner(id, title, is_private, user_id)')
            .eq('user_id', appUser.id);

          if (!collabError && collaborativeLists) {
            // Add collaborative lists to custom lists
            const collabListsFormatted = collaborativeLists.map((collab: any) => ({
              id: collab.lists.id,
              title: collab.lists.title,
              is_private: collab.lists.is_private,
              isCollaborative: true,
              owner_id: collab.lists.user_id
            }));
            
            customLists = [...customLists, ...collabListsFormatted];
            console.log("Added collaborative lists:", collabListsFormatted.length);
          }
        } catch (error) {
          console.error('Collaborative lists query failed (non-fatal):', error);
        }
      }
    }

    // Get user's media items if authenticated
    let userItems = [];
    if (targetUserId) {
      const { data: items, error: itemsError } = await supabase
        .from('list_items')
        .select('id, list_id, title, type, media_type, creator, image_url, notes, created_at, media_id, external_id, external_source')
        .eq('user_id', targetUserId)
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
      items: itemsByListId[list.id] || [],
      is_private: list.is_private
    }));

    // Convert custom lists to expected format
    const customListsWithItems = customLists.map(list => ({
      id: list.id,
      title: list.title,
      items: itemsByListId[list.id] || [],
      isCustom: true,
      isPrivate: list.is_private,
      isCollaborative: list.isCollaborative || false,
      owner_id: list.owner_id || targetUserId
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
