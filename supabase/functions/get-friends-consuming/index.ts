import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function resolveMediaType(item: any): string {
  const itemType = item.media_type?.toLowerCase();
  if (itemType && itemType !== 'mixed' && itemType !== 'unknown') {
    return itemType;
  }
  const source = (item.external_source || '').toLowerCase();
  if (source === 'tmdb' || source === 'tmdb_tv') return 'tv';
  if (source === 'tmdb_movie') return 'movie';
  if (source === 'spotify') return 'music';
  if (source === 'open_library' || source === 'google_books') return 'book';
  if (source === 'youtube') return 'video';
  return '';
}

function resolveImageUrl(item: any): string {
  const url = item.image_url || '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `https://image.tmdb.org/t/p/w300${url}`;
  return '';
}

function isTmdbSource(item: any): boolean {
  const src = (item.external_source || '').toLowerCase();
  return src === 'tmdb' || src === 'tmdb_tv' || src === 'tmdb_movie' || src === '';
}

function hasValidExternalId(item: any): boolean {
  return !!item.external_id && !isNaN(Number(item.external_id));
}

async function fixMissingData(items: any[], supabaseAdmin: any): Promise<void> {
  const tmdbKey = Deno.env.get('TMDB_API_KEY') || '';
  if (!tmdbKey) return;

  // Fix items missing a poster OR missing a valid numeric external_id (for TMDB items)
  const needsFix = items.filter(i =>
    i.title && isTmdbSource(i) && (!i.image_url || !hasValidExternalId(i))
  );
  if (needsFix.length === 0) return;

  await Promise.allSettled(needsFix.map(async (item) => {
    try {
      let poster = item.image_url || '';
      let foundExternalId = hasValidExternalId(item) ? item.external_id : null;
      const type = resolveMediaType(item);
      const searchType = type === 'movie' ? 'movie' : 'tv';

      // If we already have a valid numeric ID, just fetch the poster
      if (foundExternalId && !poster) {
        const res = await fetch(`https://api.themoviedb.org/3/${searchType}/${foundExternalId}?api_key=${tmdbKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.poster_path) poster = `https://image.tmdb.org/t/p/w300${data.poster_path}`;
        }
      }

      // Search by title if still missing poster or external_id
      if ((!poster || !foundExternalId) && item.title) {
        const searchRes = await fetch(`https://api.themoviedb.org/3/search/${searchType}?api_key=${tmdbKey}&query=${encodeURIComponent(item.title)}&page=1`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const match = searchData.results?.[0];
          if (match) {
            if (!poster && match.poster_path) poster = `https://image.tmdb.org/t/p/w300${match.poster_path}`;
            if (!foundExternalId) foundExternalId = String(match.id);
          }
        }
      }

      const updateData: any = {};
      if (poster && !item.image_url) updateData.image_url = poster;
      if (foundExternalId && !hasValidExternalId(item)) updateData.external_id = foundExternalId;
      if (item.media_type === 'mixed' || !item.media_type) updateData.media_type = type || 'tv';

      if (Object.keys(updateData).length > 0) {
        if (poster) item.image_url = poster;
        if (foundExternalId) item.external_id = foundExternalId;
        if (updateData.media_type) item.media_type = updateData.media_type;
        await supabaseAdmin.from('list_items').update(updateData).eq('id', item.id);
      }
    } catch (_e) { }
  }));
}

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
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    let friendIds: string[] = body.friendIds || [];

    if (friendIds.length === 0) {
      const { data: allLists } = await supabaseAdmin
        .from('lists')
        .select('id, user_id')
        .eq('title', 'Currently')
        .neq('user_id', user.id)
        .limit(20);

      if (!allLists?.length) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const listIds = allLists.map((l: any) => l.id);
      const userMap = new Map(allLists.map((l: any) => [l.id, l.user_id]));

      const { data: items } = await supabaseAdmin
        .from('list_items')
        .select('*')
        .in('list_id', listIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!items?.length) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const ownerIds = [...new Set(items.map((i: any) => userMap.get(i.list_id)).filter(Boolean))];
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, display_name, user_name, avatar')
        .in('id', ownerIds);

      await fixMissingData(items, supabaseAdmin);

      const usersMap = new Map((users || []).map((u: any) => [u.id, u]));
      const result = items.map((item: any) => {
        const ownerId = userMap.get(item.list_id);
        return {
          ...item,
          media_type: resolveMediaType(item),
          image_url: resolveImageUrl(item),
          owner: usersMap.get(ownerId) || {},
        };
      });

      return new Response(JSON.stringify({ items: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: currentlyLists } = await supabaseAdmin
      .from('lists')
      .select('id, user_id')
      .eq('title', 'Currently')
      .in('user_id', friendIds);

    if (!currentlyLists?.length) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const listIds = currentlyLists.map((l: any) => l.id);
    const userMap = new Map(currentlyLists.map((l: any) => [l.id, l.user_id]));

    const { data: items } = await supabaseAdmin
      .from('list_items')
      .select('*')
      .in('list_id', listIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!items?.length) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await fixMissingData(items, supabaseAdmin);

    const ownerIds = [...new Set(items.map((i: any) => userMap.get(i.list_id)).filter(Boolean))];
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, display_name, user_name, avatar')
      .in('id', ownerIds);

    const usersMap = new Map((users || []).map((u: any) => [u.id, u]));
    const result = items.map((item: any) => {
      const ownerId = userMap.get(item.list_id);
      return {
        ...item,
        media_type: resolveMediaType(item),
        image_url: resolveImageUrl(item),
        owner: usersMap.get(ownerId) || {},
      };
    });

    return new Response(JSON.stringify({ items: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message, items: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
