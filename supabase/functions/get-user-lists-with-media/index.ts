import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SYSTEM_LIST_TITLES, restoreSystemLists, canReadFriendLists, isVisibleToFriend } from "../_shared/system-lists.ts";
import { listReadScope } from "../_shared/list-read-scope.ts";

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
    console.log("Auth check result:", { userId: user?.id, userError });
    
    let appUser = null;
    if (user && !userError) {
      const accountAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      // Look up app user by email, CREATE if doesn't exist
      let { data: foundAppUser, error: appUserError } = await accountAdmin
        .from('users')
        .select('id, email, user_name')
        .eq('id', user.id)
        .single();

      // If user doesn't exist, create them
      if (appUserError && appUserError.code === 'PGRST116') {
        console.log('User not found, creating profile for:', user.id);
        
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
          
          // Signup's database trigger and owner restoration use the same five lists.
        }
      } else if (!appUserError) {
        appUser = foundAppUser;
        console.log("App user lookup:", { appUserId: appUser?.id });
      }
    }

    // Get user_id from query parameter (for viewing other users) or use logged-in user
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id') || appUser?.id;
    if (!appUser || !targetUserId) {
      return new Response(JSON.stringify({ lists: [], message: 'Not authorized to view this user\'s lists' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Determine if we're viewing another user's profile
    const isViewingOtherUser = targetUserId && appUser?.id && targetUserId !== appUser.id;
    
    const scope = listReadScope(supabase, user.id);
    // Preserve the existing authorized ratings lookup, but never bypass list RLS.
    let ratingsClient = supabase;
    
    if (isViewingOtherUser) {
      // Use service role to check friendship and fetch data
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      if (await canReadFriendLists(supabaseAdmin, appUser.id, targetUserId)) {
        ratingsClient = supabaseAdmin;
      } else {
        console.log('Users are not friends, returning empty lists for privacy');
        // Return empty lists if not friends
        return new Response(JSON.stringify({ 
          lists: [],
          message: 'Not authorized to view this user\'s lists'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    let systemLists = [];
    let customLists = [];
    
    if (targetUserId) {
      // Never mutate another member's lists while viewing their profile.
      if (appUser?.id === targetUserId) await restoreSystemLists(supabase, targetUserId);
      // Fetch system lists using the appropriate client
      const { data: userSystemLists, error: systemListsError } = await supabase
        .from('lists')
        .select('id, title, is_private, visibility')
        .eq('user_id', targetUserId)
        .eq('is_default', true)
        .order('title');

      console.log("User system lists result:", { 
        count: userSystemLists?.length, 
        systemListsError,
        lists: userSystemLists?.map(l => l.title)
      });

      // Only include standard system lists with uniqueness check
      if (systemListsError) throw new Error('Could not load system lists: ' + systemListsError.message);
      const requiredSystemLists: readonly string[] = SYSTEM_LIST_TITLES;

      // Filter and deduplicate - keep only first occurrence of each title
      const seenTitles = new Set();
      const filteredSystemLists = (userSystemLists || [])
        .filter(list => {
          if (!requiredSystemLists.includes(list.title)) return false;
          if (isViewingOtherUser && !isVisibleToFriend(list)) return false;
          if (seenTitles.has(list.title)) return false;
          seenTitles.add(list.title);
          return true;
        });

      systemLists = filteredSystemLists;

      // Fetch custom lists
      try {
        const { data: userCustomLists, error: customListsError } = await supabase
          .from('lists')
          .select('id, title, is_private, visibility')
          .eq('user_id', targetUserId)
          .or('is_default.is.null,is_default.eq.false')
          .order('title');
        
        if (!customListsError && userCustomLists) {
          customLists = isViewingOtherUser
            ? userCustomLists.filter(isVisibleToFriend)
            : userCustomLists;
          console.log("Custom lists loaded:", customLists.length);
        } else if (customListsError) {
          console.error('Error fetching custom lists (non-fatal):', customListsError);
        }
      } catch (error) {
        console.error('Custom lists query failed (non-fatal):', error);
      }

      // Fetch collaborative lists (lists where user is a collaborator)
      if (appUser?.id && !isViewingOtherUser) {
        try {
          const { data: collaborativeLists, error: collabError } = await supabase
            .from('list_collaborators')
            .select('list_id, lists!inner(id, title, is_private, visibility, user_id)')
            .eq('user_id', appUser.id);

          if (!collabError && collaborativeLists) {
            const allowed = await scope(collaborativeLists.map(row => row.list_id));
            const collabListsFormatted = collaborativeLists.filter(row => allowed.has(row.list_id)).map((collab: any) => ({
              id: collab.lists.id,
              title: collab.lists.title,
              is_private: collab.lists.is_private,
              visibility: collab.lists.visibility,
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

    // Friend All must never include unfiled rows or personal-only lists.
    let visibleListIds: string[] | null = null;
    if (isViewingOtherUser) {
      visibleListIds = [...await scope([...systemLists, ...customLists].map(list => list.id), 'friend')];
    }

    // Get user's media items
    let userItems = [];
    if (targetUserId) {
      let itemsQuery: any = supabase
        .from('list_items')
        .select('*')
        .eq('user_id', targetUserId);
      if (isViewingOtherUser) {
        itemsQuery = visibleListIds?.length
          ? itemsQuery.in('list_id', visibleListIds)
          : null;
      }
      const { data: items, error: itemsError } = itemsQuery
        ? await itemsQuery
        : { data: [], error: null };
      
      console.log('list_items query result:', { itemCount: items?.length, error: itemsError });
      
      if (itemsError) {
        console.error('Error fetching user items:', itemsError);
        throw new Error('Could not load saved media: ' + itemsError.message);
      } else {
        userItems = items || [];
      }
      if (isViewingOtherUser) {
        const allowed = new Set(visibleListIds);
        userItems = userItems.filter((item: any) => allowed.has(item.list_id));
      }
      console.log("User items count:", userItems.length);

      // Fetch items for collaborative lists (items belong to list owner, not collaborator)
      const collabListIds = customLists.filter((l: any) => l.isCollaborative).map((l: any) => l.id);
      if (!isViewingOtherUser && collabListIds.length > 0) {
        try {
          const { data: collabItems, error: collabItemsError } = await supabase
            .from('list_items')
            .select('*')
            .in('list_id', collabListIds);

          if (!collabItemsError && collabItems) {
            const existingIds = new Set(userItems.map((i: any) => i.id));
            const newCollabItems = collabItems.filter((i: any) => !existingIds.has(i.id));
            userItems = [...userItems, ...newCollabItems];
            console.log("Added collaborative list items:", newCollabItems.length);
          }
        } catch (error) {
          console.error('Collaborative items fetch failed (non-fatal):', error);
        }
      }

      // Fetch user's ratings from media_ratings table
      const { data: ratings, error: ratingsError } = await ratingsClient
        .from('media_ratings')
        .select('id, media_external_id, media_external_source, canonical_media_id, rating, updated_at')
        .eq('user_id', targetUserId)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false });
      
      if (!ratingsError && ratings) {
        // Create a lookup map for ratings by external_id + external_source
        const ratingsMap = new Map();
        ratings.forEach((r: any) => {
          const key = `${r.media_external_source}-${r.media_external_id}`;
          if (r.canonical_media_id && !ratingsMap.has(`canonical-${r.canonical_media_id}`)) {
            ratingsMap.set(`canonical-${r.canonical_media_id}`, Number(r.rating));
          }
          if (!ratingsMap.has(key) && Number.isFinite(Number(r.rating))) {
            ratingsMap.set(key, Number(r.rating));
          }
        });
        
        // Attach ratings to items
        userItems = userItems.map((item: any) => {
          if (item.external_id && item.external_source) {
            const key = item.canonical_media_id
              ? `canonical-${item.canonical_media_id}`
              : `${item.external_source}-${item.external_id}`;
            const rating = ratingsMap.get(key);
            return { ...item, user_rating: rating ?? null };
          }
          return { ...item, user_rating: null };
        });
        
        console.log("Attached ratings to items, ratings count:", ratings.length);
      }
    }

    if (isViewingOtherUser) {
      const allowed = await scope(visibleListIds || [], 'friend');
      systemLists = systemLists.filter(list => allowed.has(list.id));
      customLists = customLists.filter(list => allowed.has(list.id));
      userItems = userItems.filter(item => allowed.has(item.list_id));
    } else {
      const collaborative = customLists.filter(list => list.isCollaborative).map(list => list.id);
      const allowed = await scope(collaborative);
      customLists = customLists.filter(list => !list.isCollaborative || allowed.has(list.id));
      userItems = userItems.filter(item => item.user_id === user.id || allowed.has(item.list_id));
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
      visibility: list.visibility,
      is_default: true
    }));

    // Convert custom lists to expected format
    const customListsWithItems = customLists.map(list => ({
      id: list.id,
      title: list.title,
      items: itemsByListId[list.id] || [],
      isCustom: true,
      is_default: false,
      is_private: list.is_private,
      visibility: list.visibility,
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

    // Include every real list so My Media can preserve complete list membership
    // while deduplicating its history. The virtual All list remains first for
    // backwards-compatible consumers.
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
