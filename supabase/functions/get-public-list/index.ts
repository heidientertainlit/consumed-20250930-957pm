
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { listReadScope, verifiedListViewer } from '../_shared/list-read-scope.ts';
import { matchesListRoute } from '../../../shared/system-lists.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'private, no-store',
};

serve(async (req) => {
  console.log("get-public-list function hit!", req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // The service client is only used for the existing owner label lookup.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authorization = req.headers.get('Authorization');
    const readDb = createClient(Deno.env.get('SUPABASE_URL') ?? '', anonKey, {
      global: { headers: authorization ? { Authorization: authorization } : {} },
    });
    const { data: session, error: sessionError } = await readDb.auth.getUser();
    let viewerId: string | null;
    try {
      viewerId = verifiedListViewer(authorization, anonKey, sessionError ? null : session.user);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });
    }
    const scope = listReadScope(readDb, viewerId);

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

    const isAll = listSlug === 'all';

    // Public access must stay owner-scoped; legacy global (user_id=null) lists
    // are not the personal five-list model. Never query unfiled rows via All.
    const { data: visibleLists, error: visibleError } = await readDb.from('lists')
      .select('id, title, is_default')
      .eq('user_id', userId).eq('is_private', false).eq('visibility', 'public');
    if (visibleError) throw new Error('Could not load public lists');
    const selected = (visibleLists || []).find(list => matchesListRoute(list, listSlug));
    const candidates = isAll ? (visibleLists || []).map(list => list.id) : selected ? [selected.id] : [];
    const allowedIds = [...await scope(candidates, 'public')];
    const items = [];
    for (let start = 0; start < allowedIds.length; start += 100) {
      const { data: page, error: itemsError } = await readDb.from('list_items')
        .select('id, list_id, title, type, media_type, creator, image_url, notes, created_at, media_id, external_id, external_source')
        .eq('user_id', userId)
        .in('list_id', allowedIds.slice(start, start + 100))
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      if (itemsError) throw new Error('Could not load public list items');
      items.push(...(page || []));
    }
    const finalScope = await scope(allowedIds, 'public');
    if (!finalScope.size && !isAll) {
      return new Response(JSON.stringify({ error: 'List not found', requested_list: listSlug }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const filteredItems = items.filter(item => finalScope.has(item.list_id))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at) || b.id.localeCompare(a.id)).slice(0, 1000);

    console.log(`Filtered to ${filteredItems.length} items for list "${listSlug}"`);

    return new Response(JSON.stringify({
      list: {
        id: isAll ? 'all' : selected?.is_default ? selected.title.toLowerCase().replace(/\s+/g, '-') : selected?.id,
        title: isAll ? 'All' : selected?.title,
        is_default: isAll || selected?.is_default === true,
        items: filteredItems,
        owner: user.user_name || user.email.split('@')[0],
        is_private: false,
        visibility: 'public',
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
