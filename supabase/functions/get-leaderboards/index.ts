
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
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all_time';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 10;

    // Use regular client for authentication
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    // Get auth user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use service role client for leaderboard queries (bypass RLS to count all activity)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get or create app user
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      // User doesn't exist, create them using service role client (bypass RLS)
      console.log('Creating new user:', user.email);
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: newUser, error: createError } = await supabaseAdmin
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
        console.error('Failed to create user:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      appUser = newUser;
    } else if (appUserError) {
      console.error('App user error:', appUserError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle individual trivia challenge leaderboards
    if (category.startsWith('trivia_challenge_')) {
      const poolId = category.replace('trivia_challenge_', '');
      
      // Get predictions for this specific challenge
      const { data: predictions, error: predictionsError } = await supabase
        .from('user_predictions')
        .select('user_id, points_earned')
        .eq('pool_id', poolId);
        
      if (predictionsError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch challenge predictions' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get users for user names
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, user_name');
        
      if (usersError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Aggregate points by user
      const userMap = users.reduce((acc: any, user: any) => {
        acc[user.id] = user.user_name;
        return acc;
      }, {});

      const userPoints: { [key: string]: number } = {};
      
      predictions.forEach((prediction: any) => {
        const userId = prediction.user_id;
        userPoints[userId] = (userPoints[userId] || 0) + prediction.points_earned;
      });

      // Convert to leaderboard format and sort
      const leaderboard = Object.entries(userPoints)
        .map(([userId, points]) => ({
          user_id: userId,
          user_name: userMap[userId] || 'Anonymous',
          user_points: points as number,
          score: points as number,
          created_at: new Date().toISOString()
        }))
        .sort((a, b) => b.user_points - a.user_points)
        .slice(0, limit);

      return new Response(JSON.stringify(leaderboard), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle game-specific categories
    if (category === 'vote_leader' || category === 'predict_leader' || category === 'trivia_leader') {
      // Determine game type filter
      let gameType = '';
      if (category === 'vote_leader') gameType = 'vote';
      else if (category === 'predict_leader') gameType = 'predict';  
      else if (category === 'trivia_leader') gameType = 'trivia';
      
      // Get all predictions
      const { data: predictions, error: predictionsError } = await supabase
        .from('user_predictions')
        .select('user_id, points_earned, pool_id');
        
      if (predictionsError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch predictions' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get all games to filter by type
      const { data: games, error: gamesError } = await supabase
        .from('prediction_pools')
        .select('id, type')
        .eq('type', gameType);
        
      if (gamesError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch games' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get all users for user names
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, user_name');
        
      if (usersError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Filter predictions by game type and aggregate by user
      const gameIds = games.map(g => g.id);
      const userMap = users.reduce((acc: any, user: any) => {
        acc[user.id] = user.user_name;
        return acc;
      }, {});

      const userPoints: { [key: string]: number } = {};
      
      predictions.forEach((prediction: any) => {
        if (gameIds.includes(prediction.pool_id)) {
          const userId = prediction.user_id;
          // For predict games, show 0 points until they're resolved (all predictions are pending)
          if (gameType === 'predict') {
            userPoints[userId] = (userPoints[userId] || 0) + 0; // Always 0 for predict games
          } else {
            userPoints[userId] = (userPoints[userId] || 0) + prediction.points_earned;
          }
        }
      });

      // Convert to leaderboard format
      const leaderboard = Object.entries(userPoints)
        .map(([userId, points]) => ({
          user_id: userId,
          user_name: userMap[userId] || 'Anonymous',
          user_points: points as number,
          score: points as number,
          created_at: new Date().toISOString()
        }))
        .sort((a, b) => b.user_points - a.user_points)
        .slice(0, limit);

      return new Response(JSON.stringify(leaderboard), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle fan points category
    if (category === 'fan_points') {
      // Get all creator stats
      const { data: creatorStats, error: statsError } = await supabase
        .from('user_creator_stats')
        .select('user_id, creator_name, fan_points, media_types');
        
      if (statsError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch creator stats' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get all users for user names
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, user_name');
        
      if (usersError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Determine role based on media types
      const determineRole = (mediaTypes: string[]): string => {
        if (mediaTypes.includes('movie')) return 'Director';
        if (mediaTypes.includes('tv')) return 'Showrunner';
        if (mediaTypes.includes('book')) return 'Author';
        if (mediaTypes.includes('music')) return 'Artist';
        if (mediaTypes.includes('podcast')) return 'Podcaster';
        return 'Creator';
      };

      // Check if there's only one user (the current user)
      const uniqueUserIds = new Set(creatorStats.map((s: any) => s.user_id));
      const isSingleUser = uniqueUserIds.size === 1 && uniqueUserIds.has(user.id);

      if (isSingleUser) {
        // Single user: Show all their creators ranked by fan points
        const userStats = creatorStats
          .filter((stat: any) => {
            const creatorName = stat.creator_name;
            // Skip generic/unknown creator names
            return creatorName && 
              creatorName.toLowerCase() !== 'unknown' && 
              creatorName.toLowerCase() !== 'tv show' &&
              creatorName.toLowerCase() !== 'podcast' &&
              creatorName.toLowerCase() !== 'game' &&
              creatorName.toLowerCase() !== 'sports';
          })
          .map((stat: any) => ({
            user_id: `${user.id}-${stat.creator_name}`, // Composite key
            user_name: stat.creator_name,
            user_points: stat.fan_points,
            score: stat.fan_points,
            created_at: new Date().toISOString(),
            creator_name: stat.creator_name,
            creator_role: determineRole(stat.media_types || [])
          }))
          .sort((a, b) => b.user_points - a.user_points)
          .slice(0, limit);

        return new Response(JSON.stringify(userStats), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Multi-user: Show users ranked by their top creator
      const userMap = users.reduce((acc: any, user: any) => {
        acc[user.id] = user.user_name;
        return acc;
      }, {});

      const userMaxPoints: { [key: string]: { points: number; creator: string; mediaTypes: string[] } } = {};
      
      creatorStats.forEach((stat: any) => {
        const userId = stat.user_id;
        const creatorName = stat.creator_name;
        
        // Skip generic/unknown creator names
        if (!creatorName || 
            creatorName.toLowerCase() === 'unknown' || 
            creatorName.toLowerCase() === 'tv show' ||
            creatorName.toLowerCase() === 'podcast' ||
            creatorName.toLowerCase() === 'game' ||
            creatorName.toLowerCase() === 'sports') {
          return;
        }
        
        if (!userMaxPoints[userId] || stat.fan_points > userMaxPoints[userId].points) {
          userMaxPoints[userId] = {
            points: stat.fan_points,
            creator: stat.creator_name,
            mediaTypes: stat.media_types || []
          };
        }
      });

      // Convert to leaderboard format - show users ranked by their top creator
      const leaderboard = Object.entries(userMaxPoints)
        .map(([userId, data]) => ({
          user_id: userId,
          user_name: userMap[userId] || 'Anonymous',
          user_points: data.points,
          score: data.points,
          created_at: new Date().toISOString(),
          creator_name: data.creator,
          creator_role: determineRole(data.mediaTypes)
        }))
        .sort((a, b) => b.user_points - a.user_points)
        .slice(0, limit);

      return new Response(JSON.stringify(leaderboard), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle standard media-based categories
    let dateFilter = '';
    const now = new Date();
    
    if (category === 'daily') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      dateFilter = yesterday.toISOString();
    } else if (category === 'weekly') {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = lastWeek.toISOString();
    }

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, user_name, email');

    if (usersError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate points for each user
    const leaderboardData = [];

    for (const user of users || []) {
      let listQuery = supabase
        .from('list_items')
        .select('*')
        .eq('user_id', user.id);

      // Apply date filter if needed
      if (dateFilter) {
        listQuery = listQuery.gte('created_at', dateFilter);
      }

      const { data: listItems } = await listQuery;

      // Get user's prediction points
      let predictionQuery = supabase
        .from('user_predictions')
        .select('points_earned')
        .eq('user_id', user.id);

      // Apply date filter to predictions too
      if (dateFilter) {
        predictionQuery = predictionQuery.gte('created_at', dateFilter);
      }

      const { data: predictions } = await predictionQuery;

      // Get user's poll votes with points
      let pollQuery = supabase
        .from('poll_responses')
        .select('poll_id, created_at')
        .eq('user_id', user.id);

      // Apply date filter to polls too
      if (dateFilter) {
        pollQuery = pollQuery.gte('created_at', dateFilter);
      }

      const { data: pollVotes } = await pollQuery;

      // Get poll points for each vote
      let pollPoints = 0;
      if (pollVotes && pollVotes.length > 0) {
        const pollIds = [...new Set(pollVotes.map(v => v.poll_id))];
        const { data: polls } = await supabase
          .from('polls')
          .select('id, points_reward')
          .in('id', pollIds);
        
        if (polls) {
          const pollPointsMap = polls.reduce((acc: any, p: any) => {
            acc[p.id] = p.points_reward || 5;
            return acc;
          }, {});
          
          pollPoints = pollVotes.reduce((sum, vote) => {
            return sum + (pollPointsMap[vote.poll_id] || 5);
          }, 0);
        }
      }

      if (listItems) {
        // Count items by media type
        const books = listItems.filter(item => item.media_type === 'book');
        const movies = listItems.filter(item => item.media_type === 'movie');
        const tv = listItems.filter(item => item.media_type === 'tv');
        const music = listItems.filter(item => item.media_type === 'music');
        const podcasts = listItems.filter(item => item.media_type === 'podcast');
        const games = listItems.filter(item => item.media_type === 'game');
        const sports = listItems.filter(item => item.media_type === 'sports');
        
        // Count items with reviews (notes field)
        const reviews = listItems.filter(item => item.notes && item.notes.trim().length > 0);

        // Calculate prediction points
        const predictionPoints = (predictions || [])
          .reduce((sum, pred) => sum + (pred.points_earned || 0), 0);

        // Calculate category-specific scores
        let categoryScore = 0;
        let totalPoints = 0;

        if (category === 'book_leader') {
          categoryScore = books.length * 15;
        } else if (category === 'movie_leader') {
          categoryScore = movies.length * 8;
        } else if (category === 'tv_leader') {
          categoryScore = tv.length * 10;
        } else if (category === 'music_leader') {
          categoryScore = music.length * 1;
        } else if (category === 'podcast_leader') {
          categoryScore = podcasts.length * 3;
        } else if (category === 'sports_leader') {
          categoryScore = sports.length * 5;
        } else if (category === 'critic_leader') {
          categoryScore = reviews.length * 10;
        } else if (category === 'superstar') {
          // Superstar = users with highest total activity across all media types + predictions + polls
          categoryScore = 
            (books.length * 15) +      // Books: 15 pts each
            (movies.length * 8) +      // Movies: 8 pts each
            (tv.length * 10) +         // TV Shows: 10 pts each
            (music.length * 1) +       // Music: 1 pt each
            (podcasts.length * 3) +    // Podcasts: 3 pts each
            (games.length * 5) +       // Games: 5 pts each
            (sports.length * 5) +      // Sports: 5 pts each
            (reviews.length * 10) +    // Reviews: 10 pts each
            predictionPoints +         // Prediction points
            pollPoints;                // Poll points
        } else if (category === 'streaker') {
          // Streaker = consistency (simplified as total items for now)
          categoryScore = listItems.length * 20; // 20 points per consecutive day
        } else if (category === 'friend_inviter') {
          // Friend inviter = placeholder for future friend invitation system
          // For now, users with more diverse content get points (encourages sharing)
          const uniqueCreators = new Set(listItems.map(item => item.creator)).size;
          categoryScore = uniqueCreators * 25; // 25 points per successful friend invite
        } else {
          // Calculate total points for all_time category including predictions and polls
          totalPoints = 
            (books.length * 15) +      // Books: 15 pts each
            (movies.length * 8) +      // Movies: 8 pts each
            (tv.length * 10) +         // TV Shows: 10 pts each
            (music.length * 1) +       // Music: 1 pt each
            (podcasts.length * 3) +    // Podcasts: 3 pts each
            (games.length * 5) +       // Games: 5 pts each
            (sports.length * 5) +      // Sports: 5 pts each
            (reviews.length * 10) +    // Reviews: 10 pts each
            predictionPoints +         // Prediction points
            pollPoints;                // Poll points
          categoryScore = totalPoints;
        }

        if (categoryScore > 0) {
          leaderboardData.push({
            user_id: user.id,
            user_name: user.user_name,
            user_points: categoryScore,
            score: categoryScore, // For compatibility with frontend interface
            created_at: new Date().toISOString(),
            // Additional data for frontend display
            total_items: listItems.length,
            total_reviews: reviews.length,
            prediction_points: predictionPoints,
            total_predictions: (predictions || []).length
          });
        }
      }
    }

    // Sort by points (descending) and limit results
    const sortedLeaderboard = leaderboardData
      .sort((a, b) => b.user_points - a.user_points)
      .slice(0, limit);

    return new Response(JSON.stringify(sortedLeaderboard), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get leaderboards error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
