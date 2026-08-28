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
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || ''
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

    // Get user_id from query parameter (for viewing other users) or use logged-in user
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id') || appUser.id;

    // Completed titles are the source of consumption counts.  Keep the
    // Finished-list fallback for records created before completed_at existed.
    const { data: listItems, error: itemsError } = await supabase
      .from('list_items')
      .select('id, list_id, media_type, title, creator, external_id, external_source, completed_at')
      .eq('user_id', targetUserId);

    if (itemsError) {
      console.error('Error fetching list items:', itemsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const [{ data: userLists, error: listsError }, { data: progressEvents, error: eventsError }, { data: ratings, error: ratingsError }] = await Promise.all([
      supabase.from('lists').select('id, title, is_default').eq('user_id', targetUserId),
      supabase.from('media_progress_events').select('occurred_at').eq('user_id', targetUserId),
      supabase.from('media_ratings')
        .select('id, media_external_id, media_external_source, media_title, media_type, rating, updated_at')
        .eq('user_id', targetUserId)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false }),
    ]);
    if (listsError || eventsError || ratingsError) {
      console.error('Error fetching media history:', { listsError, eventsError, ratingsError });
      return new Response(JSON.stringify({ error: 'Failed to fetch user media history' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const finishedListIds = new Set((userLists || [])
      .filter((list: any) => list.is_default && list.title?.trim().toLowerCase() === 'finished')
      .map((list: any) => list.id));
    const normalizeType = (value: unknown) => {
      const type = String(value || '').trim().toLowerCase();
      if (['tv', 'tv show', 'tv_show', 'series'].includes(type)) return 'tv';
      if (['game', 'games', 'gaming', 'video game', 'video_game'].includes(type)) return 'game';
      if (['movie', 'movies', 'film'].includes(type)) return 'movie';
      if (['book series', 'book_series'].includes(type)) return 'book_series';
      if (['book', 'books'].includes(type)) return 'book';
      if (['music', 'album', 'albums', 'song', 'songs'].includes(type)) return 'music';
      if (['podcast', 'podcasts'].includes(type)) return 'podcast';
      if (['sports', 'sport'].includes(type)) return 'sports';
      if (['youtube', 'you tube', 'video'].includes(type)) return 'youtube';
      return 'other';
    };
    const titleIdentity = (item: any) => {
      const type = normalizeType(item.media_type);
      if (item.external_id) return `${type}|${String(item.external_source || '').trim().toLowerCase()}|${String(item.external_id).trim()}`;
      return `${type}|title|${String(item.title || '').trim().toLowerCase()}|${String(item.creator || '').trim().toLowerCase()}`;
    };

    const trackedTitles = new Map<string, string>();
    const completedTitles = new Map<string, string>();
    for (const item of listItems || []) {
      trackedTitles.set(titleIdentity(item), normalizeType(item.media_type));
      if (item.completed_at || finishedListIds.has(item.list_id)) {
        completedTitles.set(titleIdentity(item), normalizeType(item.media_type));
      }
    }
    const emptyMediaCounts = (): Record<string, number> => ({
      movie: 0, tv: 0, book: 0, book_series: 0, music: 0, podcast: 0,
      game: 0, sports: 0, youtube: 0, other: 0
    });
    const trackedMediaCounts = emptyMediaCounts();
    const completedMediaCounts = emptyMediaCounts();
    for (const type of trackedTitles.values()) trackedMediaCounts[type]++;
    for (const type of completedTitles.values()) completedMediaCounts[type]++;

    // Progress events are dated server records, rather than list creation time.
    const activeDays = new Set((progressEvents || []).map((event: any) =>
      new Date(event.occurred_at).toDateString()
    ));

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

    // media_ratings is canonical; collapse duplicate legacy rows by identity and
    // retain the newest row. Ratings are numeric, so 0.5-star values are exact.
    const canonicalRatings = new Map<string, number>();
    for (const rating of ratings || []) {
      const identity = titleIdentity({
        media_type: rating.media_type,
        external_source: rating.media_external_source,
        external_id: rating.media_external_id,
        title: rating.media_title,
      });
      if (!canonicalRatings.has(identity) && Number.isFinite(Number(rating.rating))) {
        canonicalRatings.set(identity, Number(rating.rating));
      }
    }
    const avgRating = canonicalRatings.size
      ? Array.from(canonicalRatings.values()).reduce((sum, rating) => sum + rating, 0) / canonicalRatings.size
      : 0;

    const stats = {
      moviesWatched: completedMediaCounts.movie,
      tvShowsWatched: completedMediaCounts.tv,
      booksRead: completedMediaCounts.book + completedMediaCounts.book_series,
      // Duration is not stored for every supported source. Never invent hours.
      musicHours: 0,
      podcastHours: 0,
      gamesPlayed: completedMediaCounts.game,
      totalHours: 0,
      averageRating: Math.round(avgRating * 100) / 100,
      dayStreak: streak,
      completedItems: completedTitles.size,
      musicCompleted: completedMediaCounts.music,
      podcastsCompleted: completedMediaCounts.podcast,
      otherCompleted: completedMediaCounts.other,
      trackedMediaCounts,
      completedMediaCounts,
      mediaCounts: completedMediaCounts
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