import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("get-public-ranks function hit!", req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let ranksQuery = supabaseAdmin
      .from('ranks')
      .select('id, user_id, title, description, visibility, max_items, created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      ranksQuery = ranksQuery.ilike('title', `%${search}%`);
    }

    const { data: ranks, error: ranksError } = await ranksQuery;

    if (ranksError) {
      console.error('Error fetching public ranks:', ranksError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch ranks: ' + ranksError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!ranks || ranks.length === 0) {
      return new Response(JSON.stringify({ ranks: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rankIds = ranks.map(r => r.id);
    const userIds = [...new Set(ranks.map(r => r.user_id).filter(Boolean))];

    const { data: rankItems, error: itemsError } = await supabaseAdmin
      .from('rank_items')
      .select('id, rank_id, position, title, media_type, creator, media_id, image_url')
      .in('rank_id', rankIds)
      .order('position', { ascending: true });

    if (itemsError) {
      console.error('Error fetching rank items:', itemsError);
    }

    let users: any[] = [];
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, user_name, display_name, avatar')
        .in('id', userIds);
      
      if (!usersError && usersData) {
        users = usersData;
      }
    }

    const itemsByRank: Record<string, any[]> = {};
    (rankItems || []).forEach((item: any) => {
      if (!itemsByRank[item.rank_id]) {
        itemsByRank[item.rank_id] = [];
      }
      itemsByRank[item.rank_id].push(item);
    });

    const usersMap = new Map(users.map(u => [u.id, u]));

    let ranksWithData = ranks.map(rank => {
      const items = itemsByRank[rank.id] || [];
      const userData = usersMap.get(rank.user_id);

      const matchesTopic = !topic || items.some((item: any) => {
        const mediaType = (item.media_type || '').toLowerCase();
        const topicLower = topic.toLowerCase();
        
        if (topicLower === 'movies' || topicLower === 'movie') {
          return mediaType === 'movie' || mediaType === 'movies';
        }
        if (topicLower === 'tv' || topicLower === 'tv shows') {
          return mediaType === 'tv' || mediaType === 'tv-show' || mediaType === 'tv show' || mediaType === 'tv shows';
        }
        if (topicLower === 'music') {
          return mediaType === 'music' || mediaType === 'album' || mediaType === 'song';
        }
        if (topicLower === 'books') {
          return mediaType === 'book' || mediaType === 'books';
        }
        if (topicLower === 'games') {
          return mediaType === 'game' || mediaType === 'games' || mediaType === 'video game';
        }
        if (topicLower === 'podcasts') {
          return mediaType === 'podcast' || mediaType === 'podcasts';
        }
        return mediaType.includes(topicLower);
      });

      if (!matchesTopic) return null;

      return {
        rank: {
          id: rank.id,
          title: rank.title,
          description: rank.description,
          user_id: rank.user_id,
          visibility: rank.visibility,
          max_items: rank.max_items,
          items: items.slice(0, 5),
        },
        author: {
          id: rank.user_id,
          user_name: userData?.user_name || 'Unknown',
          display_name: userData?.display_name,
          profile_image_url: userData?.avatar,
        },
        createdAt: rank.created_at,
        likesCount: 0,
        commentsCount: 0,
      };
    }).filter(Boolean);

    console.log(`Returning ${ranksWithData.length} public ranks`);

    return new Response(JSON.stringify({ ranks: ranksWithData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get public ranks error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
