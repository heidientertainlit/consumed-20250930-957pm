import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { listReadScope, verifiedListViewer } from '../_shared/list-read-scope.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'private, no-store',
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
    let viewerId: string | null;
    try {
      viewerId = verifiedListViewer(req.headers.get('Authorization'), Deno.env.get('SUPABASE_ANON_KEY') ?? '', userError ? null : user);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });
    }
    const scope = listReadScope(supabase, viewerId);
    const notFound = () => new Response(JSON.stringify({ error: 'List not found' }), { status: 404, headers: corsHeaders });
    console.log('Auth check result:', { userId: user?.id, userError });
    
    let appUser = null;
    if (user && !userError) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      // Look up app user by email, CREATE if doesn't exist
      let { data: foundAppUser, error: appUserError } = await admin
        .from('users')
        .select('id, email, user_name')
        .eq('id', user.id)
        .single();

      // If user doesn't exist, create them
      if (appUserError && appUserError.code === 'PGRST116') {
        console.log('User not found, creating profile for:', user.id);
        const { data: newUser, error: createError } = await admin
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
        console.log("App user lookup:", { appUserId: appUser?.id });
      }
    }

    // For system lists, convert URL slug back to title and find by title
    const systemListMapping = {
      'currently': 'Currently',
      'queue': 'Want To', 
      'want_to': 'Want To',
      'finished': 'Finished',
      'did-not-finish': 'Did Not Finish',
      'dnf': 'Did Not Finish',
      'favorites': 'Favorites'
    };

    let listData = null;

    // First try to find system list by mapping the slug
    if (systemListMapping[listId] && appUser) {
      console.log('Looking for system list:', systemListMapping[listId]);
      
      const { data: systemList, error: systemError } = await supabase
        .from('lists')
        .select('id, title, user_id, is_private, visibility, is_default')
        .eq('user_id', appUser.id)
        .eq('is_default', true)
        .eq('title', systemListMapping[listId])
        .single();

      if (!systemError && systemList) {
        listData = systemList;
        console.log('Found system list:', listData);
      }
    }

    // If not found as system list, try to find by actual ID
    if (!listData) {
      if (systemListMapping[listId]) {
        return new Response(JSON.stringify({ error: 'Standard list unavailable. Sign in and restore your lists.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Looking for list by ID:', listId);
      
      const { data: list, error: listError } = await supabase
        .from('lists')
        .select('id, title, user_id, is_private, visibility, is_default')
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

    if (!(await scope([listData.id])).has(listData.id)) return notFound();
    const { data: items, error: itemsError } = await supabase
      .from('list_items')
      .select('id, list_id, title, type, media_type, creator, image_url, notes, created_at, media_id, external_id, external_source, progress, total, progress_mode')
      .eq('list_id', listData.id)
      .order('created_at', { ascending: false });
    if (itemsError) throw new Error('Could not load shared list items');
    // Recheck after reading items in case the owner changed the audience.
    if (!(await scope([listData.id])).has(listData.id)) return notFound();

    const response = {
      id: listData.id,
      title: listData.title,
      user_id: listData.user_id,
      is_public: listData.is_private === false && listData.visibility === 'public',
      is_private: listData.is_private,
      visibility: listData.visibility,
      is_default: listData.is_default,
      isCustom: listData.is_default !== true,
      items: items || []
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