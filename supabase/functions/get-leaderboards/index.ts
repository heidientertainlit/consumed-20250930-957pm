import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache'
};

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  score: number;
  rank: number;
  detail?: string;
}

serve(async (req) => {
  const BUILD_VERSION = '2025-12-08-new-categories';
  console.info('🚀 get-leaderboards BUILD:', BUILD_VERSION);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const scope = searchParams.get('scope') || 'global';
    const period = searchParams.get('period') || 'all_time';
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') || '' }
        }
      }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current app user
    let { data: appUser } = await supabase
      .from('users')
      .select('id, email, user_name, display_name')
      .eq('email', user.email)
      .single();

    if (!appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get friends list for scope filtering (bidirectional)
    let friendIds: string[] = [];
    if (scope === 'friends') {
      // Get friends where current user initiated
      const { data: outboundFriends } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', appUser.id)
        .eq('status', 'accepted');
      
      // Get friends where other user initiated
      const { data: inboundFriends } = await supabase
        .from('friends')
        .select('user_id')
        .eq('friend_id', appUser.id)
        .eq('status', 'accepted');
      
      const outboundIds = (outboundFriends || []).map(f => f.friend_id);
      const inboundIds = (inboundFriends || []).map(f => f.user_id);
      
      // Combine and deduplicate
      friendIds = [...new Set([...outboundIds, ...inboundIds, appUser.id])];
    }

    // Get all users for name mapping
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, user_name, display_name');
    
    const userMap: Record<string, { username: string; display_name: string }> = {};
    (allUsers || []).forEach((u: any) => {
      userMap[u.id] = { 
        username: u.user_name || 'unknown', 
        display_name: u.display_name || u.user_name || 'Unknown' 
      };
    });

    // Date filter for period
    let dateFilter: string | null = null;
    const now = new Date();
    if (period === 'weekly') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === 'monthly') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const results: Record<string, LeaderboardEntry[]> = {};

    // Helper to format leaderboard entries
    const formatEntries = (entries: { user_id: string; score: number; detail?: string }[]): LeaderboardEntry[] => {
      let filtered = entries;
      if (scope === 'friends' && friendIds.length > 0) {
        filtered = entries.filter(e => friendIds.includes(e.user_id));
      }
      return filtered
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((e, i) => ({
          user_id: e.user_id,
          username: userMap[e.user_id]?.username || 'unknown',
          display_name: userMap[e.user_id]?.display_name || 'Unknown',
          score: e.score,
          rank: i + 1,
          detail: e.detail
        }));
    };

    // 1. OVERALL ENGAGEMENT - posts + likes received + comments received + likes given + comments given
    if (category === 'all' || category === 'overall') {
      const engagementMap: Record<string, number> = {};
      
      // Posts created (10 points each + bonus for engagement received)
      const { data: posts } = await supabase
        .from('social_posts')
        .select('user_id, likes_count, comments_count, created_at')
        .gte('created_at', dateFilter || '1970-01-01');

      (posts || []).forEach((p: any) => {
        const userId = p.user_id;
        const score = 10 + (p.likes_count || 0) * 2 + (p.comments_count || 0) * 3;
        engagementMap[userId] = (engagementMap[userId] || 0) + score;
      });

      // Likes given (2 points each)
      const { data: likesGiven } = await supabase
        .from('social_post_likes')
        .select('user_id, created_at')
        .gte('created_at', dateFilter || '1970-01-01');
      
      (likesGiven || []).forEach((like: any) => {
        engagementMap[like.user_id] = (engagementMap[like.user_id] || 0) + 2;
      });

      // Comments made (5 points each)
      const { data: commentsMade } = await supabase
        .from('social_post_comments')
        .select('user_id, created_at')
        .gte('created_at', dateFilter || '1970-01-01');
      
      (commentsMade || []).forEach((comment: any) => {
        engagementMap[comment.user_id] = (engagementMap[comment.user_id] || 0) + 5;
      });

      // Prediction pool participation (from user_predictions)
      const { data: allPredictions } = await supabase
        .from('user_predictions')
        .select('user_id, created_at')
        .gte('created_at', dateFilter || '1970-01-01');
      
      (allPredictions || []).forEach((pred: any) => {
        engagementMap[pred.user_id] = (engagementMap[pred.user_id] || 0) + 5;
      });

      // Rank creation (10 points each)
      const { data: ranks } = await supabase
        .from('ranks')
        .select('user_id, created_at')
        .gte('created_at', dateFilter || '1970-01-01');
      
      (ranks || []).forEach((rank: any) => {
        engagementMap[rank.user_id] = (engagementMap[rank.user_id] || 0) + 10;
      });

      results.overall = formatEntries(
        Object.entries(engagementMap).map(([user_id, score]) => ({ user_id, score }))
      );
    }

    // 2. TRIVIA CHAMPIONS - users who win trivia games
    if (category === 'all' || category === 'trivia') {
      // Get trivia pools
      const { data: triviaPools } = await supabase
        .from('prediction_pools')
        .select('id')
        .eq('type', 'trivia');
      
      const triviaPoolIds = (triviaPools || []).map(p => p.id);

      if (triviaPoolIds.length > 0) {
        const { data: predictions } = await supabase
          .from('user_predictions')
          .select('user_id, points_earned, is_winner, pool_id, created_at')
          .in('pool_id', triviaPoolIds)
          .gte('created_at', dateFilter || '1970-01-01');

        const triviaMap: Record<string, { wins: number; points: number }> = {};
        (predictions || []).forEach((p: any) => {
          if (!triviaMap[p.user_id]) {
            triviaMap[p.user_id] = { wins: 0, points: 0 };
          }
          if (p.is_winner) triviaMap[p.user_id].wins += 1;
          triviaMap[p.user_id].points += p.points_earned || 0;
        });

        results.trivia = formatEntries(
          Object.entries(triviaMap).map(([user_id, data]) => ({ 
            user_id, 
            score: data.points,
            detail: `${data.wins} wins`
          }))
        );
      } else {
        results.trivia = [];
      }
    }

    // 3. POLL MASTERS - users who participate in polls
    if (category === 'all' || category === 'polls') {
      const { data: pollPools } = await supabase
        .from('prediction_pools')
        .select('id')
        .eq('type', 'vote');
      
      const pollPoolIds = (pollPools || []).map(p => p.id);

      if (pollPoolIds.length > 0) {
        const { data: votes } = await supabase
          .from('user_predictions')
          .select('user_id, points_earned, pool_id, created_at')
          .in('pool_id', pollPoolIds)
          .gte('created_at', dateFilter || '1970-01-01');

        const pollMap: Record<string, { votes: number; points: number }> = {};
        (votes || []).forEach((v: any) => {
          if (!pollMap[v.user_id]) {
            pollMap[v.user_id] = { votes: 0, points: 0 };
          }
          pollMap[v.user_id].votes += 1;
          pollMap[v.user_id].points += v.points_earned || 0;
        });

        results.polls = formatEntries(
          Object.entries(pollMap).map(([user_id, data]) => ({ 
            user_id, 
            score: data.points,
            detail: `${data.votes} votes`
          }))
        );
      } else {
        results.polls = [];
      }
    }

    // 4. PREDICTION PROS - users with best prediction accuracy
    if (category === 'all' || category === 'predictions') {
      const { data: predictPools } = await supabase
        .from('prediction_pools')
        .select('id')
        .eq('type', 'predict');
      
      const predictPoolIds = (predictPools || []).map(p => p.id);

      if (predictPoolIds.length > 0) {
        const { data: predictions } = await supabase
          .from('user_predictions')
          .select('user_id, points_earned, is_winner, pool_id, created_at')
          .in('pool_id', predictPoolIds)
          .gte('created_at', dateFilter || '1970-01-01');

        const predictMap: Record<string, { correct: number; total: number; points: number }> = {};
        (predictions || []).forEach((p: any) => {
          if (!predictMap[p.user_id]) {
            predictMap[p.user_id] = { correct: 0, total: 0, points: 0 };
          }
          predictMap[p.user_id].total += 1;
          if (p.is_winner) predictMap[p.user_id].correct += 1;
          predictMap[p.user_id].points += p.points_earned || 0;
        });

        results.predictions = formatEntries(
          Object.entries(predictMap).map(([user_id, data]) => {
            const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
            return { 
              user_id, 
              score: data.points,
              detail: `${accuracy}% accuracy (${data.correct}/${data.total})`
            };
          })
        );
      } else {
        results.predictions = [];
      }
    }

    // 5. TOP CONSUMERS BY MEDIA TYPE
    if (category === 'all' || category === 'consumption') {
      // Get list items for consumption tracking
      let listQuery = supabase
        .from('list_items')
        .select('user_id, media_type, created_at');
      
      if (dateFilter) {
        listQuery = listQuery.gte('created_at', dateFilter);
      }
      
      const { data: listItems } = await listQuery;

      // Count by media type
      const consumptionMap: Record<string, Record<string, number>> = {};
      (listItems || []).forEach((item: any) => {
        if (!consumptionMap[item.user_id]) {
          consumptionMap[item.user_id] = { book: 0, movie: 0, tv: 0, music: 0, podcast: 0, game: 0, total: 0 };
        }
        const mediaType = item.media_type || 'other';
        if (consumptionMap[item.user_id][mediaType] !== undefined) {
          consumptionMap[item.user_id][mediaType] += 1;
        }
        consumptionMap[item.user_id].total += 1;
      });

      // Books
      results.books = formatEntries(
        Object.entries(consumptionMap)
          .filter(([_, data]) => data.book > 0)
          .map(([user_id, data]) => ({ 
            user_id, 
            score: data.book,
            detail: `${data.book} books`
          }))
      );

      // Movies
      results.movies = formatEntries(
        Object.entries(consumptionMap)
          .filter(([_, data]) => data.movie > 0)
          .map(([user_id, data]) => ({ 
            user_id, 
            score: data.movie,
            detail: `${data.movie} movies`
          }))
      );

      // TV Shows
      results.tv = formatEntries(
        Object.entries(consumptionMap)
          .filter(([_, data]) => data.tv > 0)
          .map(([user_id, data]) => ({ 
            user_id, 
            score: data.tv,
            detail: `${data.tv} shows`
          }))
      );

      // Music
      results.music = formatEntries(
        Object.entries(consumptionMap)
          .filter(([_, data]) => data.music > 0)
          .map(([user_id, data]) => ({ 
            user_id, 
            score: data.music,
            detail: `${data.music} tracks`
          }))
      );

      // Podcasts
      results.podcasts = formatEntries(
        Object.entries(consumptionMap)
          .filter(([_, data]) => data.podcast > 0)
          .map(([user_id, data]) => ({ 
            user_id, 
            score: data.podcast,
            detail: `${data.podcast} podcasts`
          }))
      );

      // Games
      results.games = formatEntries(
        Object.entries(consumptionMap)
          .filter(([_, data]) => data.game > 0)
          .map(([user_id, data]) => ({ 
            user_id, 
            score: data.game,
            detail: `${data.game} games`
          }))
      );

      // Total consumption
      results.total_consumption = formatEntries(
        Object.entries(consumptionMap)
          .filter(([_, data]) => data.total > 0)
          .map(([user_id, data]) => ({ 
            user_id, 
            score: data.total,
            detail: `${data.total} items`
          }))
      );
    }

    return new Response(JSON.stringify({
      categories: results,
      currentUserId: appUser.id,
      scope,
      period
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get leaderboards error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
