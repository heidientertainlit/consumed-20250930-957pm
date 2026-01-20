import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("seed-consumed-ranks function hit!", req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: ranks } = await supabaseAdmin
      .from('ranks')
      .select('id, title')
      .eq('origin_type', 'consumed');

    if (!ranks || ranks.length === 0) {
      return new Response(JSON.stringify({ error: 'No consumed ranks found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rankMap: Record<string, string> = {};
    for (const r of ranks) {
      if (r.title === 'Top 10 Movies of the 80s') rankMap.movies80s = r.id;
      if (r.title === 'Top 10 TV Dramas of All Time') rankMap.tvdramas = r.id;
      if (r.title === 'Top Songs of the 90s') rankMap.songs90s = r.id;
      if (r.title === 'Greatest Books of All Time') rankMap.books = r.id;
      if (r.title === 'Top Sci-Fi Movies Ever Made') rankMap.scifi = r.id;
      if (r.title === 'Best Albums of 2024') rankMap.albums2024 = r.id;
      if (r.title === 'Best Startup Books Ever') rankMap.startupbooks = r.id;
      if (r.title === 'Best Decades for Music') rankMap.musicdecades = r.id;
      if (r.title === 'Best Podcasts for True Crime Fans') rankMap.truecrime = r.id;
      if (r.title === 'Must-Read Fantasy Series') rankMap.fantasy = r.id;
    }

    console.log('Found rank IDs:', Object.keys(rankMap));

    const CONSUMED_USER_ID = '88bfb2a0-e8ce-4081-b731-2a49567ff093';
    
    const items: any[] = [];

    if (rankMap.movies80s) {
      items.push(
        { rank_id: rankMap.movies80s, user_id: CONSUMED_USER_ID, position: 1, title: 'Back to the Future', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.movies80s, user_id: CONSUMED_USER_ID, position: 2, title: 'E.T. the Extra-Terrestrial', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.movies80s, user_id: CONSUMED_USER_ID, position: 3, title: 'Raiders of the Lost Ark', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.movies80s, user_id: CONSUMED_USER_ID, position: 4, title: 'The Breakfast Club', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.movies80s, user_id: CONSUMED_USER_ID, position: 5, title: 'Ghostbusters', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.tvdramas) {
      items.push(
        { rank_id: rankMap.tvdramas, user_id: CONSUMED_USER_ID, position: 1, title: 'Breaking Bad', media_type: 'tv', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.tvdramas, user_id: CONSUMED_USER_ID, position: 2, title: 'The Sopranos', media_type: 'tv', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.tvdramas, user_id: CONSUMED_USER_ID, position: 3, title: 'The Wire', media_type: 'tv', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.tvdramas, user_id: CONSUMED_USER_ID, position: 4, title: 'Mad Men', media_type: 'tv', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.tvdramas, user_id: CONSUMED_USER_ID, position: 5, title: 'Game of Thrones', media_type: 'tv', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.songs90s) {
      items.push(
        { rank_id: rankMap.songs90s, user_id: CONSUMED_USER_ID, position: 1, title: 'Smells Like Teen Spirit', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.songs90s, user_id: CONSUMED_USER_ID, position: 2, title: 'Wonderwall', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.songs90s, user_id: CONSUMED_USER_ID, position: 3, title: 'Wannabe', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.songs90s, user_id: CONSUMED_USER_ID, position: 4, title: 'No Diggity', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.songs90s, user_id: CONSUMED_USER_ID, position: 5, title: 'I Want It That Way', media_type: 'music', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.books) {
      items.push(
        { rank_id: rankMap.books, user_id: CONSUMED_USER_ID, position: 1, title: 'To Kill a Mockingbird', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.books, user_id: CONSUMED_USER_ID, position: 2, title: '1984', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.books, user_id: CONSUMED_USER_ID, position: 3, title: 'Pride and Prejudice', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.books, user_id: CONSUMED_USER_ID, position: 4, title: 'The Great Gatsby', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.books, user_id: CONSUMED_USER_ID, position: 5, title: 'Harry Potter and the Sorcerer\'s Stone', media_type: 'book', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.scifi) {
      items.push(
        { rank_id: rankMap.scifi, user_id: CONSUMED_USER_ID, position: 1, title: 'Blade Runner', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.scifi, user_id: CONSUMED_USER_ID, position: 2, title: '2001: A Space Odyssey', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.scifi, user_id: CONSUMED_USER_ID, position: 3, title: 'The Matrix', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.scifi, user_id: CONSUMED_USER_ID, position: 4, title: 'Star Wars', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.scifi, user_id: CONSUMED_USER_ID, position: 5, title: 'Alien', media_type: 'movie', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.albums2024) {
      items.push(
        { rank_id: rankMap.albums2024, user_id: CONSUMED_USER_ID, position: 1, title: 'The Tortured Poets Department', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.albums2024, user_id: CONSUMED_USER_ID, position: 2, title: 'Cowboy Carter', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.albums2024, user_id: CONSUMED_USER_ID, position: 3, title: 'Hit Me Hard and Soft', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.albums2024, user_id: CONSUMED_USER_ID, position: 4, title: 'eternal sunshine', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.albums2024, user_id: CONSUMED_USER_ID, position: 5, title: 'BRAT', media_type: 'music', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.startupbooks) {
      items.push(
        { rank_id: rankMap.startupbooks, user_id: CONSUMED_USER_ID, position: 1, title: 'Zero to One', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.startupbooks, user_id: CONSUMED_USER_ID, position: 2, title: 'The Lean Startup', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.startupbooks, user_id: CONSUMED_USER_ID, position: 3, title: 'Good to Great', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.startupbooks, user_id: CONSUMED_USER_ID, position: 4, title: 'The Hard Thing About Hard Things', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.startupbooks, user_id: CONSUMED_USER_ID, position: 5, title: 'Thinking, Fast and Slow', media_type: 'book', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.musicdecades) {
      items.push(
        { rank_id: rankMap.musicdecades, user_id: CONSUMED_USER_ID, position: 1, title: 'The 1980s', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.musicdecades, user_id: CONSUMED_USER_ID, position: 2, title: 'The 1970s', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.musicdecades, user_id: CONSUMED_USER_ID, position: 3, title: 'The 1990s', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.musicdecades, user_id: CONSUMED_USER_ID, position: 4, title: 'The 1960s', media_type: 'music', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.musicdecades, user_id: CONSUMED_USER_ID, position: 5, title: 'The 2000s', media_type: 'music', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.truecrime) {
      items.push(
        { rank_id: rankMap.truecrime, user_id: CONSUMED_USER_ID, position: 1, title: 'Serial', media_type: 'podcast', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.truecrime, user_id: CONSUMED_USER_ID, position: 2, title: 'My Favorite Murder', media_type: 'podcast', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.truecrime, user_id: CONSUMED_USER_ID, position: 3, title: 'Crime Junkie', media_type: 'podcast', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.truecrime, user_id: CONSUMED_USER_ID, position: 4, title: 'Casefile True Crime', media_type: 'podcast', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.truecrime, user_id: CONSUMED_USER_ID, position: 5, title: 'Up and Vanished', media_type: 'podcast', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    if (rankMap.fantasy) {
      items.push(
        { rank_id: rankMap.fantasy, user_id: CONSUMED_USER_ID, position: 1, title: 'The Lord of the Rings', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.fantasy, user_id: CONSUMED_USER_ID, position: 2, title: 'A Song of Ice and Fire', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.fantasy, user_id: CONSUMED_USER_ID, position: 3, title: 'Harry Potter', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.fantasy, user_id: CONSUMED_USER_ID, position: 4, title: 'The Wheel of Time', media_type: 'book', up_vote_count: 0, down_vote_count: 0 },
        { rank_id: rankMap.fantasy, user_id: CONSUMED_USER_ID, position: 5, title: 'The Stormlight Archive', media_type: 'book', up_vote_count: 0, down_vote_count: 0 }
      );
    }

    console.log('Inserting', items.length, 'items');

    const { error: insertError } = await supabaseAdmin.from('rank_items').insert(items);
    
    if (insertError) {
      console.error('Error inserting items:', insertError);
      return new Response(JSON.stringify({
        error: 'Failed to insert items: ' + insertError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Successfully seeded', items.length, 'rank items!');

    return new Response(JSON.stringify({
      success: true,
      itemsInserted: items.length,
      ranksPopulated: Object.keys(rankMap).length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Seed consumed ranks error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
