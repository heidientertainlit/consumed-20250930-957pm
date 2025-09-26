
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

    // Calculate leaderboard based on actual list_items data
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
      let query = supabase
        .from('list_items')
        .select('*')
        .eq('user_id', user.id);

      // Apply date filter if needed
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: listItems } = await query;

      if (listItems) {
        // Count items by media type
        const books = listItems.filter(item => item.media_type === 'book');
        const movies = listItems.filter(item => item.media_type === 'movie');
        const tv = listItems.filter(item => item.media_type === 'tv');
        const music = listItems.filter(item => item.media_type === 'music');
        const podcasts = listItems.filter(item => item.media_type === 'podcast');
        const games = listItems.filter(item => item.media_type === 'game');
        
        // Count items with reviews (notes field)
        const reviews = listItems.filter(item => item.notes && item.notes.trim().length > 0);

        // Calculate category-specific scores
        let categoryScore = 0;
        let totalPoints = 0;

        if (category === 'bookworm') {
          categoryScore = books.length * 15;
        } else if (category === 'cinephile') {
          categoryScore = movies.length * 8;
        } else if (category === 'series_slayer') {
          categoryScore = tv.length * 10;
        } else if (category === 'track_star') {
          categoryScore = music.length * 1;
        } else if (category === 'podster') {
          categoryScore = podcasts.length * 3;
        } else if (category === 'sports_fanatic') {
          const sports = listItems.filter(item => item.media_type === 'sports');
          categoryScore = sports.length * 5; // 5 points per sports event tracked
        } else if (category === 'top_critic') {
          categoryScore = reviews.length * 10;
        } else if (category === 'superstar') {
          // Superstar = users with high activity across all categories
          categoryScore = (books.length > 0 ? 1 : 0) + 
                         (movies.length > 0 ? 1 : 0) + 
                         (tv.length > 0 ? 1 : 0) + 
                         (music.length > 0 ? 1 : 0) + 
                         (podcasts.length > 0 ? 1 : 0) + 
                         (games.length > 0 ? 1 : 0) + 
                         (listItems.filter(item => item.media_type === 'sports').length > 0 ? 1 : 0);
          categoryScore = categoryScore * 20; // 20 points per category participated in
        } else if (category === 'streaker') {
          // Streaker = consistency (simplified as total items for now)
          categoryScore = listItems.length * 2;
        } else if (category === 'friend_inviter') {
          // Friend inviter = placeholder for future friend invitation system
          // For now, users with more diverse content get points (encourages sharing)
          const uniqueCreators = new Set(listItems.map(item => item.creator)).size;
          categoryScore = uniqueCreators * 5; // 5 points per unique creator (diversity bonus)
        } else {
          // Calculate total points for all_time category
          totalPoints = 
            (books.length * 15) +      // Books: 15 pts each
            (movies.length * 8) +      // Movies: 8 pts each
            (tv.length * 10) +         // TV Shows: 10 pts each
            (music.length * 1) +       // Music: 1 pt each
            (podcasts.length * 3) +    // Podcasts: 3 pts each
            (games.length * 5) +       // Games: 5 pts each
            (listItems.filter(item => item.media_type === 'sports').length * 5) + // Sports: 5 pts each
            (reviews.length * 10);     // Reviews: 10 pts each
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
            total_reviews: reviews.length
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
