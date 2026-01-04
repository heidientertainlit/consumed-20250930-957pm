import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache'
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

    // Count accepted friendships (5 pts per friend)
    // User can appear in either user_id or friend_id column
    const { data: friendshipsAsUser } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('status', 'accepted');
    
    const { data: friendshipsAsFriend } = await supabase
      .from('friendships')
      .select('id')
      .eq('friend_id', targetUserId)
      .eq('status', 'accepted');
    
    const friendCount = (friendshipsAsUser?.length || 0) + (friendshipsAsFriend?.length || 0);
    const friendPoints = friendCount * 5;

    // Count successful referrals (25 pts per referral that made first action)
    const { data: referrals } = await supabase
      .from('users')
      .select('id')
      .eq('referred_by', targetUserId)
      .eq('referral_rewarded', true);
    
    const referralCount = referrals?.length || 0;
    const referralPoints = referralCount * 25;

    // Calculate engagement points
    let engagementPoints = 0;
    let engagementBreakdown = {
      posts: 0,
      likesReceived: 0,
      commentsReceived: 0,
      likesGiven: 0,
      commentsMade: 0,
      predictionsParticipated: 0,
      ranksCreated: 0
    };

    // Posts created (10 pts each + bonus for engagement received)
    const { data: posts } = await supabase
      .from('social_posts')
      .select('id, likes_count, comments_count')
      .eq('user_id', targetUserId);
    
    (posts || []).forEach((p: any) => {
      engagementBreakdown.posts += 10;
      engagementBreakdown.likesReceived += (p.likes_count || 0) * 2;
      engagementBreakdown.commentsReceived += (p.comments_count || 0) * 3;
    });

    // Likes given (2 pts each)
    const { data: likesGiven } = await supabase
      .from('social_post_likes')
      .select('id')
      .eq('user_id', targetUserId);
    
    engagementBreakdown.likesGiven = (likesGiven?.length || 0) * 2;

    // Comments made (5 pts each)
    const { data: commentsMade } = await supabase
      .from('social_post_comments')
      .select('id')
      .eq('user_id', targetUserId);
    
    engagementBreakdown.commentsMade = (commentsMade?.length || 0) * 5;

    // Predictions participated (5 pts each)
    const { data: predictionsParticipated } = await supabase
      .from('user_predictions')
      .select('id')
      .eq('user_id', targetUserId);
    
    engagementBreakdown.predictionsParticipated = (predictionsParticipated?.length || 0) * 5;

    // Ranks created (10 pts each)
    const { data: ranksCreated } = await supabase
      .from('ranks')
      .select('id')
      .eq('user_id', targetUserId);
    
    engagementBreakdown.ranksCreated = (ranksCreated?.length || 0) * 10;

    engagementPoints = engagementBreakdown.posts + engagementBreakdown.likesReceived + 
      engagementBreakdown.commentsReceived + engagementBreakdown.likesGiven + 
      engagementBreakdown.commentsMade + engagementBreakdown.predictionsParticipated + 
      engagementBreakdown.ranksCreated;

    // Get user's prediction/trivia/poll points with pool type info
    const { data: userPredictions } = await supabase
      .from('user_predictions')
      .select('points_earned, pool_id, prediction_pools(type)')
      .eq('user_id', targetUserId);

    // Separate points by pool type
    let predictionPoints = 0;
    let triviaPoints = 0;
    let pollPoints = 0;
    let predictionCount = 0;
    let triviaCount = 0;
    let pollCount = 0;

    (userPredictions || []).forEach((pred: any) => {
      const poolType = pred.prediction_pools?.type || 'predict';
      const pts = pred.points_earned || 0;
      
      if (poolType === 'trivia') {
        triviaPoints += pts;
        triviaCount++;
      } else if (poolType === 'vote') {
        pollPoints += pts;
        pollCount++;
      } else {
        // 'predict', 'weekly', 'awards', 'bracket' all count as predictions
        predictionPoints += pts;
        predictionCount++;
      }
    });

    // Count bet winnings (5 pts per won bet)
    const { data: wonBets } = await supabase
      .from('bets')
      .select('id, points_awarded')
      .eq('user_id', targetUserId)
      .eq('status', 'won');
    
    const betsWonCount = wonBets?.length || 0;
    const betsPoints = (wonBets || []).reduce((sum: number, bet: any) => sum + (bet.points_awarded || 0), 0);

    // Calculate totals
    const bookPoints = books.length * 15;
    const moviePoints = movies.length * 8;
    const tvPoints = tv.length * 10;
    const musicPoints = music.length * 1;
    const podcastPoints = podcasts.length * 3;
    const gamePoints = games.length * 5;
    const reviewPoints = reviews.length * 10;

    const allTimePoints = bookPoints + moviePoints + tvPoints + musicPoints + podcastPoints + gamePoints + reviewPoints + predictionPoints + triviaPoints + pollPoints + betsPoints + friendPoints + referralPoints + engagementPoints;

    // Calculate global rank by counting users with more points
    // Use service role for cross-user queries
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all users' list items to calculate their points
    const { data: allListItems } = await supabaseAdmin
      .from('list_items')
      .select('user_id, media_type, notes');

    const { data: allPredictions } = await supabaseAdmin
      .from('user_predictions')
      .select('user_id, points_earned');

    // Calculate points for all users
    const userPointsMap: Record<string, number> = {};
    
    if (allListItems) {
      for (const item of allListItems) {
        if (!userPointsMap[item.user_id]) userPointsMap[item.user_id] = 0;
        
        // Add points based on media type
        switch (item.media_type) {
          case 'book': userPointsMap[item.user_id] += 15; break;
          case 'movie': userPointsMap[item.user_id] += 8; break;
          case 'tv': userPointsMap[item.user_id] += 10; break;
          case 'music': userPointsMap[item.user_id] += 1; break;
          case 'podcast': userPointsMap[item.user_id] += 3; break;
          case 'game': userPointsMap[item.user_id] += 5; break;
        }
        
        // Add review points
        if (item.notes && item.notes.trim().length > 0) {
          userPointsMap[item.user_id] += 10;
        }
      }
    }

    // Add prediction points
    if (allPredictions) {
      for (const pred of allPredictions) {
        if (!userPointsMap[pred.user_id]) userPointsMap[pred.user_id] = 0;
        userPointsMap[pred.user_id] += (pred.points_earned || 0);
      }
    }

    // Add bet winnings to global ranking calculation
    const { data: allWonBets } = await supabaseAdmin
      .from('bets')
      .select('user_id, points_awarded')
      .eq('status', 'won');
    
    if (allWonBets) {
      for (const bet of allWonBets) {
        if (!userPointsMap[bet.user_id]) userPointsMap[bet.user_id] = 0;
        userPointsMap[bet.user_id] += (bet.points_awarded || 0);
      }
    }

    // Count how many users have more points than current user
    const currentUserPoints = userPointsMap[targetUserId] || 0;
    const usersWithMorePoints = Object.values(userPointsMap).filter(pts => pts > currentUserPoints).length;
    const globalRank = usersWithMorePoints + 1;
    const totalUsersWithPoints = Object.keys(userPointsMap).length;

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
      { user_id: appUser.id, category: 'trivia', points: triviaPoints },
      { user_id: appUser.id, category: 'polls', points: pollPoints },
      { user_id: appUser.id, category: 'bets', points: betsPoints },
      { user_id: appUser.id, category: 'friends', points: friendPoints },
      { user_id: appUser.id, category: 'referrals', points: referralPoints },
      { user_id: appUser.id, category: 'engagement', points: engagementPoints }
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
        trivia: triviaPoints,
        polls: pollPoints,
        bets: betsPoints,
        friends: friendPoints,
        referrals: referralPoints,
        engagement: engagementPoints
      },
      counts: {
        books: books.length,
        movies: movies.length,
        tv: tv.length,
        music: music.length,
        podcasts: podcasts.length,
        games: games.length,
        reviews: reviews.length,
        predictions: predictionCount,
        trivia: triviaCount,
        polls: pollCount,
        bets: betsWonCount,
        friends: friendCount,
        referrals: referralCount,
        engagement: 1,
        total: listItems.length
      },
      engagementBreakdown,
      rank: {
        global: globalRank,
        total_users: totalUsersWithPoints
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