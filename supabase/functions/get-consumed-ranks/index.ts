import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const CONSUMED_USER_ID = '00000000-0000-0000-0000-000000000001';

const CONSUMED_RANKS_DATA = [
  {
    title: 'Best 90s Movies',
    description: 'Classic films from the greatest decade in cinema',
    category: 'movies',
    items: [
      { position: 1, title: 'Pulp Fiction', media_type: 'movie', creator: 'Quentin Tarantino' },
      { position: 2, title: 'The Shawshank Redemption', media_type: 'movie', creator: 'Frank Darabont' },
      { position: 3, title: 'Fight Club', media_type: 'movie', creator: 'David Fincher' },
      { position: 4, title: 'The Matrix', media_type: 'movie', creator: 'The Wachowskis' },
      { position: 5, title: 'Forrest Gump', media_type: 'movie', creator: 'Robert Zemeckis' },
    ],
  },
  {
    title: 'Top Sci-Fi TV Shows',
    description: 'Mind-bending television at its finest',
    category: 'tv',
    items: [
      { position: 1, title: 'Breaking Bad', media_type: 'tv', creator: 'Vince Gilligan' },
      { position: 2, title: 'Black Mirror', media_type: 'tv', creator: 'Charlie Brooker' },
      { position: 3, title: 'Stranger Things', media_type: 'tv', creator: 'The Duffer Brothers' },
      { position: 4, title: 'Westworld', media_type: 'tv', creator: 'Jonathan Nolan' },
      { position: 5, title: 'The Expanse', media_type: 'tv', creator: 'Mark Fergus' },
    ],
  },
  {
    title: 'GOAT Albums of All Time',
    description: 'The greatest albums ever recorded',
    category: 'music',
    items: [
      { position: 1, title: 'Thriller', media_type: 'music', creator: 'Michael Jackson' },
      { position: 2, title: 'Abbey Road', media_type: 'music', creator: 'The Beatles' },
      { position: 3, title: 'To Pimp a Butterfly', media_type: 'music', creator: 'Kendrick Lamar' },
      { position: 4, title: 'The Dark Side of the Moon', media_type: 'music', creator: 'Pink Floyd' },
      { position: 5, title: 'Rumours', media_type: 'music', creator: 'Fleetwood Mac' },
    ],
  },
];

serve(async (req) => {
  console.log("get-consumed-ranks function hit!", req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'fetch';

    if (action === 'seed') {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', CONSUMED_USER_ID)
        .maybeSingle();

      if (!existingUser) {
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: CONSUMED_USER_ID,
            email: 'consumed@consumed.app',
            user_name: 'Consumed',
            display_name: 'Consumed',
          });

        if (userError) {
          console.error('Error creating Consumed user:', userError);
        }
      }

      for (const rankData of CONSUMED_RANKS_DATA) {
        const { data: existingRank } = await supabaseAdmin
          .from('ranks')
          .select('id')
          .eq('user_id', CONSUMED_USER_ID)
          .eq('title', rankData.title)
          .maybeSingle();

        if (!existingRank) {
          const { data: newRank, error: rankError } = await supabaseAdmin
            .from('ranks')
            .insert({
              user_id: CONSUMED_USER_ID,
              title: rankData.title,
              description: rankData.description,
              category: rankData.category,
              visibility: 'public',
              max_items: 10,
            })
            .select('id')
            .single();

          if (rankError) {
            console.error('Error creating rank:', rankError);
            continue;
          }

          const itemsToInsert = rankData.items.map(item => ({
            rank_id: newRank.id,
            user_id: CONSUMED_USER_ID,
            position: item.position,
            title: item.title,
            media_type: item.media_type,
            creator: item.creator,
          }));

          const { error: itemsError } = await supabaseAdmin
            .from('rank_items')
            .insert(itemsToInsert);

          if (itemsError) {
            console.error('Error creating rank items:', itemsError);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, message: 'Consumed ranks seeded' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: consumedRanks, error: ranksError } = await supabaseAdmin
      .from('ranks')
      .select('id, title, description, category, visibility, max_items, created_at')
      .eq('user_id', CONSUMED_USER_ID)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });

    if (ranksError) {
      console.error('Error fetching consumed ranks:', ranksError);
      return new Response(JSON.stringify({ error: ranksError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!consumedRanks || consumedRanks.length === 0) {
      return new Response(JSON.stringify({ ranks: [], needsSeeding: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rankIds = consumedRanks.map(r => r.id);

    const { data: rankItems } = await supabaseAdmin
      .from('rank_items')
      .select('id, rank_id, position, title, media_type, creator, media_id, image_url')
      .in('rank_id', rankIds)
      .order('position', { ascending: true });

    const itemsByRank: Record<string, any[]> = {};
    (rankItems || []).forEach((item: any) => {
      if (!itemsByRank[item.rank_id]) {
        itemsByRank[item.rank_id] = [];
      }
      itemsByRank[item.rank_id].push(item);
    });

    const ranksWithData = consumedRanks.map(rank => ({
      postId: `consumed-${rank.id}`,
      rank: {
        id: rank.id,
        title: rank.title,
        description: rank.description,
        user_id: CONSUMED_USER_ID,
        visibility: rank.visibility,
        max_items: rank.max_items,
        items: itemsByRank[rank.id] || [],
      },
      author: {
        id: CONSUMED_USER_ID,
        user_name: 'Consumed',
        display_name: 'Consumed',
      },
      isConsumed: true,
      createdAt: rank.created_at,
      likesCount: 0,
      commentsCount: 0,
    }));

    console.log(`Returning ${ranksWithData.length} Consumed ranks`);

    return new Response(JSON.stringify({ ranks: ranksWithData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get consumed ranks error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
