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

        // Calculate total points
        const totalPoints = 
          (books.length * 15) +      // Books: 15 pts each
          (movies.length * 8) +      // Movies: 8 pts each
          (tv.length * 10) +         // TV Shows: 10 pts each
          (music.length * 1) +       // Music: 1 pt each
          (podcasts.length * 3) +    // Podcasts: 3 pts each
          (games.length * 5) +       // Games: 5 pts each
          (reviews.length * 10);     // Reviews: 10 pts each

        if (totalPoints > 0) {
          leaderboardData.push({
            user_id: user.id,
            user_name: user.user_name,
            user_points: totalPoints,
            score: totalPoints, // For compatibility with frontend interface
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