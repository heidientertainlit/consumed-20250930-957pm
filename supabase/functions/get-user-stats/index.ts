import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("get-user-stats function hit!", req.method, req.url);
  
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
    console.log('Auth check result:', { user: user?.email, userError });
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email, CREATE if doesn't exist
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    // If user doesn't exist, create them
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.email.split('@')[0] || 'user'
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        console.error('Failed to create user:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        appUser = newUser;
        console.log('Created new user:', appUser);
      }
    } else if (appUserError) {
      console.error('Error looking up user:', appUserError);
      return new Response(JSON.stringify({ error: 'User lookup failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("App user lookup:", { appUser: appUser?.email });

    // Get all user's list items
    const { data: listItems, error: itemsError } = await supabase
      .from('list_items')
      .select('media_type, created_at, notes')
      .eq('user_id', appUser.id);

    if (itemsError) {
      console.error('Error fetching list items:', itemsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${listItems?.length || 0} list items for user`);

    // Count by media type
    const mediaCounts = {
      movie: 0,
      tv: 0,
      book: 0,
      music: 0,
      podcast: 0,
      game: 0
    };

    listItems?.forEach(item => {
      const mediaType = item.media_type?.toLowerCase();
      if (mediaType && mediaCounts.hasOwnProperty(mediaType)) {
        mediaCounts[mediaType]++;
      }
    });

    // Calculate estimated hours (rough estimates based on media type)
    const estimatedHours = {
      movies: mediaCounts.movie * 2, // 2 hours per movie
      tvShows: mediaCounts.tv * 10, // 10 hours per TV show (rough average)
      books: mediaCounts.book * 8, // 8 hours per book
      music: mediaCounts.music * 0.5, // 30 minutes per music item
      podcasts: mediaCounts.podcast * 1, // 1 hour per podcast
      games: mediaCounts.game * 20 // 20 hours per game
    };

    const totalHours = Object.values(estimatedHours).reduce((sum, hours) => sum + hours, 0);

    // Calculate activity streak (days with activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentItems = listItems?.filter(item => 
      new Date(item.created_at) >= thirtyDaysAgo
    ) || [];

    // Get unique days with activity
    const activeDays = new Set(
      recentItems.map(item => 
        new Date(item.created_at).toDateString()
      )
    );

    // Calculate consecutive days from today backwards
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateString = checkDate.toDateString();
      
      if (activeDays.has(dateString)) {
        streak++;
      } else if (i > 0) {
        // Break streak if no activity (but allow today to be empty)
        break;
      }
    }

    // Mock average rating for now (would need ratings table)
    const avgRating = listItems && listItems.length > 0 ? 4.2 : 0;

    const stats = {
      moviesWatched: mediaCounts.movie,
      tvShowsWatched: mediaCounts.tv,
      booksRead: mediaCounts.book,
      musicHours: Math.round(estimatedHours.music),
      podcastHours: Math.round(estimatedHours.podcasts),
      gamesPlayed: mediaCounts.game,
      totalHours: Math.round(totalHours),
      averageRating: avgRating,
      dayStreak: streak
    };

    console.log('Returning user stats:', stats);

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});