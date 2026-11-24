import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SYSTEM_LIST_TITLES, restoreSystemLists, canReadFriendLists, isVisibleToFriend } from "../_shared/system-lists.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    let appUser = null;
    if (user && !userError) {
      const { data: accountProfile } = await supabase.rpc('get_my_account_profile');
      appUser = Array.isArray(accountProfile) ? accountProfile[0] : accountProfile;
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id') || appUser?.id;
    
    if (!targetUserId) {
      return new Response(JSON.stringify({ lists: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!appUser) {
      return new Response(JSON.stringify({ lists: [], total_items: 0, message: 'Not authorized to view this user\'s lists' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const isViewingOtherUser = targetUserId !== appUser.id;
    let queryClient = supabase;
    
    if (isViewingOtherUser) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      if (!await canReadFriendLists(supabaseAdmin, appUser.id, targetUserId)) {
        return new Response(JSON.stringify({ 
          lists: [],
          message: 'Not authorized to view this user\'s lists'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      queryClient = supabaseAdmin;
    }

    if (appUser?.id === targetUserId) await restoreSystemLists(supabase, targetUserId);
    const listsResult = await queryClient
      .from('lists')
      .select('id, title, is_private, is_default, visibility')
      .eq('user_id', targetUserId)
      .order('title');
    if (listsResult.error) throw new Error('Could not load lists: ' + listsResult.error.message);
    const allLists = isViewingOtherUser ? (listsResult.data || []).filter(isVisibleToFriend) : listsResult.data || [];
    const allowed = isViewingOtherUser ? new Set(allLists.map(list => list.id)) : null;
    const itemsQuery = queryClient.from('list_items').select('list_id').eq('user_id', targetUserId);
    const [itemCountsResult, collabResult] = await Promise.all([
      allowed ? allowed.size ? itemsQuery.in('list_id', [...allowed]) : { data: [], error: null } : itemsQuery,
      // Get collaborative lists
      !isViewingOtherUser ? supabase
        .from('list_collaborators')
        .select('list_id, lists!inner(id, title, is_private, visibility, user_id)')
        .eq('user_id', appUser.id) : Promise.resolve({ data: null, error: null })
    ]);

    if (itemCountsResult.error) throw new Error('Could not load list counts: ' + itemCountsResult.error.message);
    const itemCounts = (itemCountsResult.data || []).reduce((acc: Record<string, number>, item: { list_id: string }) => {
      if (allowed && !allowed.has(item.list_id)) return acc;
      acc[item.list_id] = (acc[item.list_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Required system lists
    const requiredSystemLists: readonly string[] = SYSTEM_LIST_TITLES;
    
    // Separate system and custom lists
    const seenTitles = new Set();
    const systemLists = allLists
      .filter(list => list.is_default && requiredSystemLists.includes(list.title))
      .filter(list => {
        if (seenTitles.has(list.title)) return false;
        seenTitles.add(list.title);
        return true;
      })
      .map(list => ({
        id: list.id,
        title: list.title,
        is_private: list.is_private,
        visibility: list.visibility || (list.is_private ? 'private' : 'public'),
        is_default: true,
        item_count: itemCounts[list.id] || 0
      }));

    const customLists = allLists
      .filter(list => !list.is_default)
      .map(list => ({
        id: list.id,
        title: list.title,
        is_private: list.is_private,
        visibility: list.visibility || (list.is_private ? 'private' : 'public'),
        isCustom: true,
        item_count: itemCounts[list.id] || 0
      }));

    // Add collaborative lists
    if (!isViewingOtherUser && collabResult.data) {
      collabResult.data.forEach((collab: any) => {
        customLists.push({
          id: collab.lists.id,
          title: collab.lists.title,
          is_private: collab.lists.is_private,
          visibility: collab.lists.visibility || (collab.lists.is_private ? 'private' : 'public'),
          isCustom: true,
          isCollaborative: true,
          owner_id: collab.lists.user_id,
          item_count: itemCounts[collab.lists.id] || 0
        });
      });
    }

    // Calculate total items
    const totalItems = Object.values(itemCounts).reduce((sum: number, count: number) => sum + count, 0);

    // All list (virtual)
    const allList = {
      id: 'all',
      title: 'All',
      is_default: true,
      item_count: totalItems
    };

    const finalLists = [allList, ...systemLists, ...customLists];

    return new Response(JSON.stringify({ 
      lists: finalLists,
      total_items: totalItems
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
