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

async function fetchMissingPosters(items: any[], supabaseAdmin: any): Promise<void> {
  const tmdbKey = Deno.env.get('TMDB_API_KEY') || '';
  const needsPoster = items.filter(i => !i.image_url && i.external_id && !isNaN(Number(i.external_id)));
  if (!tmdbKey || needsPoster.length === 0) return;

  await Promise.allSettled(needsPoster.map(async (item) => {
    try {
      const type = resolveMediaType(item);
      const endpoint = type === 'movie' ? 'movie' : 'tv';
      const res = await fetch(`https://api.themoviedb.org/3/${endpoint}/${item.external_id}?api_key=${tmdbKey}`);
      if (!res.ok) return;
      const data = await res.json();
      const poster = data.poster_path ? `https://image.tmdb.org/t/p/w300${data.poster_path}` : '';
      if (poster) {
        item.image_url = poster;
        await supabaseAdmin
          .from('list_items')
          .update({ image_url: poster })
          .eq('id', item.id)
          .then(() => {});
      }
    } catch { }
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

      await fetchMissingPosters(items, supabaseAdmin);

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

    await fetchMissingPosters(items, supabaseAdmin);

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
