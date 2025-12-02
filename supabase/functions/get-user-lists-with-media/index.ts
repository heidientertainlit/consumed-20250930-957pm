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
        .select('id, email, user_name')
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
          .upsert({
            id: user.id,
            email: user.email,
            user_name: user.user_metadata?.user_name || user.email.split('@')[0],
            display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || ''
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select('id, email, user_name')
          .single();

        if (createError) {
          console.error('Failed to create/update user:', createError);
          // Try to fetch existing user instead
          const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id, email, user_name')
            .eq('id', user.id)
            .single();
          appUser = existingUser;
        } else {
          appUser = newUser;
          console.log('Created new user:', appUser);
          
          // Create personal system lists for new user (idempotent)
          const systemLists = [
            'Currently',
            'Want To',
            'Finished',
            'Did Not Finish',
            'Favorites'
          ];

          for (const listTitle of systemLists) {
            const { error: listError } = await supabaseAdmin
              .from('lists')
              .upsert({
                user_id: newUser.id,
                title: listTitle,
                is_default: true,
                is_private: false
              }, {
                onConflict: 'user_id,title',
                ignoreDuplicates: true
              })
              .select('id, title, is_default, is_private')
              .maybeSingle();
            
            if (listError) {
              console.warn(`List creation warning for ${listTitle}:`, listError);
              // Don't fail on list creation errors - continue
            } else {
              console.log(`Created/verified ${listTitle} list`);
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

    let systemLists = [];
    let customLists = [];
    
    if (targetUserId) {
      // Fetch system lists
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

      // Only include standard system lists with uniqueness check
      const requiredSystemLists = [
        'Currently',
        'Want To',
        'Finished',
        'Did Not Finish',
        'Favorites'
      ];

      // Filter and deduplicate - keep only first occurrence of each title
      const seenTitles = new Set();
      const filteredSystemLists = (userSystemLists || [])
        .filter(list => {
          if (!requiredSystemLists.includes(list.title)) return false;
          if (seenTitles.has(list.title)) return false;
          seenTitles.add(list.title);
          return true;
        });

      const existingTitles = new Set(filteredSystemLists.map(l => l.title));
      const missingLists = requiredSystemLists.filter(title => !existingTitles.has(title));

      if (missingLists.length > 0 && appUser?.id) {
        console.log(`Auto-migration: Backfilling ${missingLists.length} missing system lists`);
        
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        for (const listTitle of missingLists) {
          const { error: listError } = await supabaseAdmin
            .from('lists')
            .upsert({
              user_id: appUser.id,
              title: listTitle,
              is_default: true,
              is_private: false
            }, {
              onConflict: 'user_id,title',
              ignoreDuplicates: true
            })
            .select('id, title, is_default, is_private')
            .maybeSingle();
          
          if (listError) {
            console.warn(`Backfill warning for ${listTitle}:`, listError);
          }
        }

        // Re-fetch system lists after backfill
        const { data: updatedSystemLists } = await supabase
          .from('lists')
          .select('id, title, is_private')
          .eq('user_id', targetUserId)
          .eq('is_default', true)
          .order('title');
        
        // Deduplicate after backfill
        const seenAfterBackfill = new Set();
        systemLists = (updatedSystemLists || []).filter(list => {
          if (!requiredSystemLists.includes(list.title)) return false;
          if (seenAfterBackfill.has(list.title)) return false;
          seenAfterBackfill.add(list.title);
          return true;
        });
        console.log('System lists after backfill:', systemLists.length);
      } else {
        systemLists = filteredSystemLists;
      }

      // Fetch custom lists
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

    // Get user's media items
    let userItems = [];
    if (targetUserId) {
      const { data: items, error: itemsError } = await supabase
        .from('list_items')
        .select('id, list_id, title, type, media_type, creator, image_url, notes, created_at, media_id, external_id, external_source, progress, total, progress_mode')
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
      is_private: list.is_private,
      is_default: true
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

    // Add "All" category
    const allList = {
      id: 'all',
      title: 'All',
      items: userItems,
      is_default: true
    };

    // Assemble final lists
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
