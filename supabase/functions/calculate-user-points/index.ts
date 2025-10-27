import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      // Create user if doesn't exist
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          display_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user'
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
    } else if (appUserError) {
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user_id from query parameter (for viewing other users) or use logged-in user
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id') || appUser.id;

    // Calculate points for each category based on list_items
    // Get all user's list items
    const { data: listItems } = await supabase
      .from('list_items')
      .select('*')
      .eq('user_id', targetUserId);

    if (!listItems) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch user items' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Count items by media type
    const books = listItems.filter(item => item.media_type === 'book');
    const movies = listItems.filter(item => item.media_type === 'movie');
    const tv = listItems.filter(item => item.media_type === 'tv');
    const music = listItems.filter(item => item.media_type === 'music');
    const podcasts = listItems.filter(item => item.media_type === 'podcast');
    const games = listItems.filter(item => item.media_type === 'game');
    
    // Count items with reviews (notes field)
    const reviews = listItems.filter(item => item.notes && item.notes.trim().length > 0);

    // Get user's prediction/trivia/poll points (all in user_predictions now)
    const { data: predictions } = await supabase
      .from('user_predictions')
      .select('points_earned')
      .eq('user_id', targetUserId);

    const predictionPoints = (predictions || [])
      .reduce((sum, pred) => sum + (pred.points_earned || 0), 0);

    // Poll points are now included in user_predictions (consolidated system)
    // No need to query poll_responses separately
    const pollPoints = 0; // Legacy variable, kept for backwards compatibility

    // Calculate totals
    const bookPoints = books.length * 15;
    const moviePoints = movies.length * 8;
    const tvPoints = tv.length * 10;
    const musicPoints = music.length * 1;
    const podcastPoints = podcasts.length * 3;
    const gamePoints = games.length * 5;
    const reviewPoints = reviews.length * 10;

    const allTimePoints = bookPoints + moviePoints + tvPoints + musicPoints + podcastPoints + gamePoints + reviewPoints + predictionPoints + pollPoints;

    // Create the points data - we'll use a simple user_points table with category and points
    const pointsData = [
      { user_id: appUser.id, category: 'all_time', points: allTimePoints },
      { user_id: appUser.id, category: 'books', points: bookPoints },
      { user_id: appUser.id, category: 'movies', points: moviePoints },
      { user_id: appUser.id, category: 'tv', points: tvPoints },
      { user_id: appUser.id, category: 'music', points: musicPoints },
      { user_id: appUser.id, category: 'podcasts', points: podcastPoints },
      { user_id: appUser.id, category: 'games', points: gamePoints },
      { user_id: appUser.id, category: 'reviews', points: reviewPoints },
      { user_id: appUser.id, category: 'predictions', points: predictionPoints },
      { user_id: appUser.id, category: 'polls', points: pollPoints }
    ];

    // First try to create the user_points table if it doesn't exist (this might fail, that's ok)
    try {
      for (const pointData of pointsData) {
        const { error: upsertError } = await supabase
          .from('user_points')
          .upsert(pointData, { onConflict: 'user_id,category' });
        
        if (upsertError) {
          console.log('Upsert error (expected if table doesn\'t exist):', upsertError);
        }
      }
    } catch (error) {
      console.log('Points upsert failed, table might not exist:', error);
    }

    return new Response(JSON.stringify({
      success: true,
      points: {
        all_time: allTimePoints,
        books: bookPoints,
        movies: moviePoints,
        tv: tvPoints,
        music: musicPoints,
        podcasts: podcastPoints,
        games: gamePoints,
        reviews: reviewPoints,
        predictions: predictionPoints,
        polls: pollPoints
      },
      counts: {
        books: books.length,
        movies: movies.length,
        tv: tv.length,
        music: music.length,
        podcasts: podcasts.length,
        games: games.length,
        reviews: reviews.length,
        predictions: predictions?.length || 0,
        polls: 0, // Poll votes now counted in predictions
        total: listItems.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Calculate points error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});