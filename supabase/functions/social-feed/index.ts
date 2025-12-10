import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
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

    // Create admin client at function level for RLS-bypassing operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Auth user:', user.email);

    // Get or create app user
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      // User doesn't exist, create them using service role client (bypass RLS)
      console.log('Creating new user:', user.email);
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          display_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user'
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        console.error('Failed to create/update user:', createError);
        // Try to fetch existing user instead
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id, email, user_name')
          .eq('id', user.id)
          .single();
        appUser = existingUser || null;
      } else {
        appUser = newUser;
      }
      
      if (!appUser) {
        return new Response(JSON.stringify({ error: 'Failed to initialize user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (appUserError) {
      console.error('App user error:', appUserError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      console.log('Getting social posts and predictions...');
      
      // Get pagination params from query string
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '15', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      
      console.log('Pagination:', { limit, offset });
      
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select(`
          id, 
          user_id, 
          content, 
          post_type, 
          rating, 
          progress, 
          created_at, 
          updated_at, 
          likes_count, 
          comments_count, 
          media_title, 
          media_type, 
          media_creator, 
          image_url, 
          media_external_id, 
          media_external_source, 
          media_description,
          contains_spoilers,
          prediction_pool_id,
          list_id,
          rank_id
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.log('Query failed:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Found posts:', posts?.length || 0);

      // Fetch prediction pools for posts with prediction_pool_id
      let predictionPoolMap = new Map<string, any>();
      const predictionPoolIds = posts?.filter(p => p.prediction_pool_id).map(p => p.prediction_pool_id) || [];
      
      if (predictionPoolIds.length > 0) {
        // Use admin client to bypass RLS on prediction_pools
        const { data: pools, error: poolsError } = await supabaseAdmin
          .from('prediction_pools')
          .select('id, title, description, options, status, type, origin_type, origin_user_id, created_at, likes_count, comments_count, media_external_id, media_external_source, media_title')
          .in('id', predictionPoolIds);
        
        if (pools) {
          predictionPoolMap = new Map(pools.map(p => [p.id, p]));
          console.log('Prediction pools fetched:', pools.length);
        }
        if (poolsError) {
          console.error('Error fetching prediction pools:', poolsError);
        }
      }

      console.log('Prediction pools loaded:', predictionPoolMap.size);

      // Helper function to ensure image URL is present and properly formatted
      const ensureImageUrl = (imageUrl: string | null, externalId: string | null, externalSource: string | null): string => {
        if (!imageUrl) return '';
        
        // If it's already a full URL, return as-is
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          return imageUrl;
        }
        
        // If it's a relative TMDB path (starts with /), convert to full URL
        if (imageUrl.startsWith('/') && (externalSource === 'tmdb' || externalSource === 'movie' || externalSource === 'tv')) {
          return `https://image.tmdb.org/t/p/w500${imageUrl}`;
        }
        
        return imageUrl;
      };

      // Create mapping from pool_id to media data from associated social_posts
      // Fall back to prediction_pools.media_title if social_posts.media_title is null or matches question
      const poolMediaTitleMap = new Map<string, string>();
      const poolMediaDataMap = new Map<string, any>();
      posts?.forEach(post => {
        if (post.prediction_pool_id) {
          const pool = predictionPoolMap.get(post.prediction_pool_id);
          
          // Smart media title: skip post.media_title if it matches the question/content
          // This handles cases where question was accidentally stored as media_title
          const postMediaTitle = post.media_title;
          const poolMediaTitle = pool?.media_title;
          const questionContent = post.content || pool?.title;
          
          // Use post.media_title only if it's different from the question
          const isPostTitleValid = postMediaTitle && 
            postMediaTitle !== questionContent && 
            !postMediaTitle.toLowerCase().includes(questionContent?.toLowerCase()?.substring(0, 15) || '');
          
          const mediaTitle = isPostTitleValid ? postMediaTitle : (poolMediaTitle || null);
          
          if (mediaTitle) {
            poolMediaTitleMap.set(post.prediction_pool_id, mediaTitle);
          }
          // Store full media data for building mediaItems
          poolMediaDataMap.set(post.prediction_pool_id, {
            title: mediaTitle,
            mediaType: post.media_type,
            externalId: post.media_external_id || pool?.media_external_id,
            externalSource: post.media_external_source || pool?.media_external_source,
            imageUrl: ensureImageUrl(post.image_url, post.media_external_id, post.media_external_source),
            creator: post.media_creator
          });
        }
      });

      // Convert prediction pools to predictions array
      const predictions: any[] = Array.from(predictionPoolMap.values());
      console.log('DEBUG: predictions data:', predictions.length, 'pools');
      
      // Fetch votes for predictions first
      let votes: any[] = [];
      if (predictions && predictions.length > 0) {
        const predictionIds = predictions.map(p => p.id);
        console.log('DEBUG: predictionIds for vote lookup:', predictionIds);
        
        const { data: votesData, error: votesError } = await supabaseAdmin
          .from('user_predictions')
          .select('pool_id, prediction, user_id')
          .in('pool_id', predictionIds);

        if (votesError) {
          console.error('DEBUG: Error fetching votes:', votesError);
        }
        
        votes = votesData || [];
      }

      // Check if current user has voted on any predictions
      const { data: userVotes, error: userVotesError } = await supabase
        .from('user_predictions')
        .select('pool_id')
        .eq('user_id', appUser.id);

      if (userVotesError) {
        console.error('DEBUG: Error fetching user votes:', userVotesError);
      }

      const userVotedPoolIds = new Set(userVotes?.map(v => v.pool_id) || []);
      console.log('DEBUG: User voted pool IDs:', Array.from(userVotedPoolIds));

      // Collect all user IDs including post creators, prediction creators, invited friends, AND voters
      const voterIds = votes.map(v => v.user_id);
      const userIds = [
        ...new Set([
          ...((posts?.map(post => post.user_id) || []) as string[]),
          ...((predictions?.map(pred => pred.origin_user_id) || []) as string[]),
          ...((predictions?.map(pred => pred.invited_user_id) || []).filter(id => id) as string[]),
          ...voterIds
        ])
      ];
      
      // Skip user lookup if no user IDs to fetch - use admin client to bypass RLS
      let users: any[] = [];
      let usersError = null;
      if (userIds.length > 0) {
        const result = await supabaseAdmin
          .from('users')
          .select('id, user_name, display_name, email, avatar')
          .in('id', userIds);
        users = result.data || [];
        usersError = result.error;
      }

      console.log('User lookup result:', { users: users?.length, usersError });

      // Get posts that the current user has liked
      const postIds = posts?.map(post => post.id) || [];
      const { data: userLikes, error: likesError } = await supabase
        .from('social_post_likes')
        .select('social_post_id')
        .eq('user_id', appUser.id)
        .in('social_post_id', postIds);

      console.log('User likes lookup:', { likes: userLikes?.length, likesError });

      const likedPostIds = new Set(userLikes?.map(like => like.social_post_id) || []);
      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      // Fetch list data for posts with list_id (added_to_list OR rate-review posts with list)
      const listIds = posts?.filter(p => p.list_id).map(p => p.list_id) || [];
      const uniqueListIds = [...new Set(listIds)];
      let listDataMap = new Map<string, { title: string; items: any[]; totalCount: number }>();
      
      // For added_to_list posts WITHOUT list_id, try to infer the list from content
      // Content format: "Added X to Currently" or "Added X to Want To", etc.
      const postsNeedingListLookup = posts?.filter(p => 
        p.post_type === 'added_to_list' && !p.list_id && p.content
      ) || [];
      
      const postToListIdMap = new Map<string, string>(); // post_id -> list_id
      
      if (postsNeedingListLookup.length > 0) {
        console.log('Found posts needing list lookup:', postsNeedingListLookup.length);
        
        // Get unique user IDs that need list lookup
        const usersNeedingLookup = [...new Set(postsNeedingListLookup.map(p => p.user_id))];
        
        // Fetch ALL lists for these users
        const { data: allUserLists } = await supabaseAdmin
          .from('lists')
          .select('id, title, user_id')
          .in('user_id', usersNeedingLookup);
        
        // Build a map of user_id -> { listTitle -> listId }
        const userListMap: { [userId: string]: Map<string, string> } = {};
        if (allUserLists) {
          for (const list of allUserLists) {
            if (!userListMap[list.user_id]) {
              userListMap[list.user_id] = new Map();
            }
            userListMap[list.user_id].set(list.title.toLowerCase(), list.id);
          }
        }
        
        console.log('Loaded lists for users:', Object.keys(userListMap).length);
        
        // Match posts to lists using flexible content parsing
        for (const post of postsNeedingListLookup) {
          const userLists = userListMap[post.user_id];
          if (!userLists) continue;
          
          // Extract list name from content - match "to → ListName" or "to ListName" at end
          // Use flexible regex that captures everything after "to" (with optional arrow)
          const match = post.content.match(/(?:to\s*(?:→|->)?\s*)([^→]+?)\s*$/i);
          if (match) {
            const extractedName = match[1].trim();
            const listId = userLists.get(extractedName.toLowerCase());
            if (listId) {
              postToListIdMap.set(post.id, listId);
              uniqueListIds.push(listId);
              console.log('Matched list from content:', { postId: post.id, listName: extractedName, listId });
            } else {
              console.log('No list found for name:', { postId: post.id, content: post.content, extractedName });
            }
          } else {
            console.log('No list match for content format:', { postId: post.id, content: post.content });
          }
        }
        
        console.log('Inferred list IDs for posts:', postToListIdMap.size);
      }
      
      // Deduplicate list IDs
      const allListIds = [...new Set(uniqueListIds)];
      
      if (allListIds.length > 0) {
        // Fetch list titles
        const { data: lists, error: listsError } = await supabaseAdmin
          .from('lists')
          .select('id, title, user_id')
          .in('id', allListIds);
        
        if (listsError) {
          console.error('Error fetching lists:', listsError);
        }
        
        // Fetch list items for each list (limited to 4 items per list)
        const { data: allListItems, error: itemsError } = await supabaseAdmin
          .from('list_items')
          .select('id, list_id, title, media_type, creator, image_url, external_id, external_source, created_at')
          .in('list_id', allListIds)
          .order('created_at', { ascending: false });
        
        if (itemsError) {
          console.error('Error fetching list items:', itemsError);
        }
        
        // Get total counts per list
        const itemCountsByList: { [key: string]: number } = {};
        allListItems?.forEach(item => {
          itemCountsByList[item.list_id] = (itemCountsByList[item.list_id] || 0) + 1;
        });
        
        // Group items by list_id (only first 4)
        const itemsByList: { [key: string]: any[] } = {};
        allListItems?.forEach(item => {
          if (!itemsByList[item.list_id]) {
            itemsByList[item.list_id] = [];
          }
          if (itemsByList[item.list_id].length < 4) {
            itemsByList[item.list_id].push(item);
          }
        });
        
        // Build the map
        lists?.forEach(list => {
          listDataMap.set(list.id, {
            title: list.title,
            items: itemsByList[list.id] || [],
            totalCount: itemCountsByList[list.id] || 0
          });
        });
        
        console.log('List data loaded:', listDataMap.size, 'lists');
      }

      // Fetch rank data for rank_share posts
      const rankIds = posts?.filter(p => p.rank_id && p.post_type === 'rank_share').map(p => p.rank_id) || [];
      const uniqueRankIds = [...new Set(rankIds)];
      let rankDataMap = new Map<string, any>();
      
      console.log('DEBUG: Looking for rank_share posts, found rank IDs:', uniqueRankIds);
      
      if (uniqueRankIds.length > 0) {
        // Fetch ranks
        const { data: ranks, error: ranksError } = await supabaseAdmin
          .from('ranks')
          .select('id, user_id, title, description, visibility, max_items, created_at')
          .in('id', uniqueRankIds);
        
        console.log('DEBUG: Fetched ranks:', ranks?.length, 'error:', ranksError);
        
        if (ranksError) {
          console.error('Error fetching ranks:', ranksError);
        }
        
        // Fetch rank items for each rank - use select('*') to match get-user-ranks
        const { data: allRankItems, error: rankItemsError } = await supabaseAdmin
          .from('rank_items')
          .select('*')
          .in('rank_id', uniqueRankIds)
          .order('position', { ascending: true });
        
        console.log('DEBUG: Fetched rank items:', allRankItems?.length, 'error:', rankItemsError, 'rankIds queried:', uniqueRankIds, 'items:', JSON.stringify(allRankItems?.slice(0, 3)));
        
        if (rankItemsError) {
          console.error('Error fetching rank items:', rankItemsError);
        }

        // Get user's votes on these rank items
        const rankItemIds = allRankItems?.map(item => item.id) || [];
        let userRankVotesMap = new Map<string, string>();
        
        if (rankItemIds.length > 0 && appUser) {
          const { data: userRankVotes } = await supabaseAdmin
            .from('rank_item_votes')
            .select('rank_item_id, direction')
            .eq('voter_id', appUser.id)
            .in('rank_item_id', rankItemIds);
          
          userRankVotes?.forEach(vote => {
            userRankVotesMap.set(vote.rank_item_id, vote.direction);
          });
        }
        
        // Group items by rank_id
        const itemsByRank: { [key: string]: any[] } = {};
        allRankItems?.forEach(item => {
          if (!itemsByRank[item.rank_id]) {
            itemsByRank[item.rank_id] = [];
          }
          itemsByRank[item.rank_id].push({
            ...item,
            user_vote: userRankVotesMap.get(item.id) || null
          });
        });
        
        // Build the map
        ranks?.forEach(rank => {
          rankDataMap.set(rank.id, {
            id: rank.id,
            user_id: rank.user_id,
            title: rank.title,
            description: rank.description,
            visibility: rank.visibility,
            max_items: rank.max_items,
            created_at: rank.created_at,
            items: itemsByRank[rank.id] || []
          });
        });
        
        console.log('Rank data loaded:', rankDataMap.size, 'ranks');
      }

      // Get predictions that the current user has liked
      const predictionIds = predictions?.map(pred => pred.id) || [];
      let likedPredictionIds = new Set<string>();
      if (predictionIds.length > 0) {
        const { data: predictionLikes, error: predLikesError } = await supabaseAdmin
          .from('prediction_likes')
          .select('pool_id')
          .eq('user_id', appUser.id)
          .in('pool_id', predictionIds);

        console.log('Prediction likes lookup:', { likes: predictionLikes?.length, predLikesError });
        likedPredictionIds = new Set(predictionLikes?.map(like => like.pool_id) || []);
      }

      // NOW process votes with userMap available
      let voteCounts: { [poolId: string]: { [option: string]: number } } = {};
      let userVoteDetails: { [poolId: string]: Array<{ user: string; vote: string; userId: string }> } = {};
      
      votes.forEach((vote: any) => {
        if (!voteCounts[vote.pool_id]) {
          voteCounts[vote.pool_id] = {};
          userVoteDetails[vote.pool_id] = [];
        }
        voteCounts[vote.pool_id][vote.prediction] = (voteCounts[vote.pool_id][vote.prediction] || 0) + 1;
        
        const voter = userMap.get(vote.user_id);
        userVoteDetails[vote.pool_id].push({
          user: voter?.user_name || 'Unknown',
          vote: vote.prediction,
          userId: vote.user_id
        });
      });

      console.log('DEBUG: Vote counts:', voteCounts);

      // DISABLED: Group posts by media - treating all posts individually for now
      // TODO: Re-enable grouping when bugs are fixed
      const ENABLE_MEDIA_GROUPING = false;
      
      // ENABLED: Consolidate added_to_list posts by user + list + time window
      // This prevents duplicate posts when a user adds multiple items to the SAME list at once
      const TIME_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
      const listAdditionGroups = new Map<string, any[]>();
      
      const mediaGroups = new Map<string, any[]>();
      const nonMediaPosts: any[] = [];

      // First pass: group ALL added_to_list posts by user only
      // This consolidates all list additions from the same user within the time window
      posts?.forEach(post => {
        if (post.post_type === 'added_to_list') {
          const groupKey = post.user_id; // Group by user only - simpler and always works
          if (!listAdditionGroups.has(groupKey)) {
            listAdditionGroups.set(groupKey, []);
          }
          listAdditionGroups.get(groupKey)!.push(post);
        }
      });
      
      console.log('List addition groups found:', listAdditionGroups.size, 'users with added_to_list posts');
      
      // Find posts to consolidate (keep only the newest post per user+list+time window)
      const postsToSkip = new Set<string>();
      
      listAdditionGroups.forEach((listPosts, groupKey) => {
        if (listPosts.length > 1) {
          // Sort by created_at ascending (oldest first)
          listPosts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          // Sliding window: track start time and representative (newest in window)
          let windowStart = new Date(listPosts[0].created_at).getTime();
          let windowRepId = listPosts[0].id;
          let windowRepTime = windowStart;
          
          for (let i = 1; i < listPosts.length; i++) {
            const postTime = new Date(listPosts[i].created_at).getTime();
            
            if (postTime - windowStart <= TIME_WINDOW_MS) {
              // Within same window - this post is newer, becomes representative
              postsToSkip.add(windowRepId); // Skip previous representative
              windowRepId = listPosts[i].id;
              windowRepTime = postTime;
            } else {
              // New window - keep current representative, start new window
              windowStart = postTime;
              windowRepId = listPosts[i].id;
              windowRepTime = postTime;
            }
          }
          // The final windowRepId is kept (not added to postsToSkip)
        }
      });
      
      console.log('List consolidation: skipping', postsToSkip.size, 'duplicate posts');

      posts?.forEach(post => {
        // Skip posts that should be consolidated
        if (postsToSkip.has(post.id)) {
          return;
        }
        
        const hasMedia = post.media_title && post.media_title.trim() !== '' && post.media_external_id;
        
        // rank_share posts need special handling - don't group them with media
        // When grouping is disabled, treat all media posts as single posts (groupPosts.length === 1 path)
        if (ENABLE_MEDIA_GROUPING && hasMedia && post.post_type !== 'prediction' && post.post_type !== 'poll' && post.post_type !== 'trivia' && post.post_type !== 'rank_share') {
          const mediaKey = `${post.media_external_source}:${post.media_external_id}`;
          if (!mediaGroups.has(mediaKey)) {
            mediaGroups.set(mediaKey, []);
          }
          mediaGroups.get(mediaKey)!.push(post);
        } else if (hasMedia && post.post_type !== 'prediction' && post.post_type !== 'poll' && post.post_type !== 'trivia' && post.post_type !== 'rank_share') {
          // Grouping disabled - put each media post in its own group so it goes through the single-post path
          const uniqueKey = `${post.media_external_source}:${post.media_external_id}:${post.id}`;
          mediaGroups.set(uniqueKey, [post]);
        } else {
          nonMediaPosts.push(post);
        }
      });

      // Transform grouped media posts
      const groupedItems: any[] = [];
      
      mediaGroups.forEach((groupPosts, mediaKey) => {
        if (groupPosts.length === 1) {
          // If only one post about this media, don't group it
          const post = groupPosts[0];
          const postUser = userMap.get(post.user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
          
          // Get list data for added_to_list posts - use stored list_id or inferred from content
          const effectiveListId = post.list_id || postToListIdMap.get(post.id);
          const listData = effectiveListId ? listDataMap.get(effectiveListId) : null;
          
          groupedItems.push({
            id: post.id,
            type: post.post_type || 'update',
            user: {
              id: post.user_id,
              username: postUser.user_name || 'Unknown',
              displayName: postUser.display_name || postUser.user_name || 'Unknown',
              avatar: postUser.avatar || '',
              email: postUser.email || ''
            },
            content: post.content || '',
            timestamp: post.created_at,
            likes: post.likes_count || 0,
            comments: post.comments_count || 0,
            shares: 0,
            likedByCurrentUser: likedPostIds.has(post.id),
            rating: post.rating,
            progress: post.progress,
            containsSpoilers: post.contains_spoilers || false,
            listId: effectiveListId || null,
            listData: listData ? {
              title: listData.title,
              items: listData.items.map(item => ({
                id: item.id,
                title: item.title,
                mediaType: item.media_type,
                creator: item.creator,
                imageUrl: item.image_url,
                externalId: item.external_id,
                externalSource: item.external_source
              })),
              totalCount: listData.totalCount
            } : null,
            mediaItems: [{
              id: `${post.media_external_source}-${post.media_external_id}`,
              title: post.media_title || '',
              creator: post.media_creator || '',
              mediaType: post.media_type || 'unknown',
              imageUrl: ensureImageUrl(post.image_url, post.media_external_id, post.media_external_source),
              rating: post.rating,
              externalId: post.media_external_id || '',
              externalSource: post.media_external_source || ''
            }]
          });
        } else {
          // Group multiple posts about the same media
          const firstPost = groupPosts[0];
          // Get most recent timestamp safely
          const mostRecentTimestamp = groupPosts.reduce((latest, post) => {
            return new Date(post.created_at) > new Date(latest) ? post.created_at : latest;
          }, groupPosts[0].created_at);
          
          const activities = groupPosts.map(post => {
            const postUser = userMap.get(post.user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
            let activityText = '';
            
            if (post.post_type === 'finished') {
              activityText = 'finished it';
            } else if (post.post_type === 'added_to_list') {
              activityText = 'added it to their list';
            } else if (post.post_type === 'rating') {
              // Handle fractional ratings safely
              const rating = Math.max(0, Math.min(5, Math.floor(post.rating || 0)));
              const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
              activityText = `rated it ${stars}`;
            } else if (post.post_type === 'progress') {
              activityText = `updated progress`;
            } else if (post.post_type === 'review') {
              activityText = 'reviewed it';
            } else {
              activityText = 'shared it';
            }
            
            return {
              postId: post.id,
              userId: post.user_id,
              username: postUser.user_name || 'Unknown',
              displayName: postUser.display_name || postUser.user_name || 'Unknown',
              avatar: postUser.avatar || '',
              email: postUser.email || '',
              activityText,
              content: post.content || '',
              rating: post.rating,
              timestamp: post.created_at
            };
          });
          
          groupedItems.push({
            id: `grouped-${mediaKey}`,
            type: 'media_group',
            timestamp: mostRecentTimestamp,
            mediaItems: [{
              id: `${firstPost.media_external_source}-${firstPost.media_external_id}`,
              title: firstPost.media_title || '',
              creator: firstPost.media_creator || '',
              mediaType: firstPost.media_type || 'unknown',
              imageUrl: ensureImageUrl(firstPost.image_url, firstPost.media_external_id, firstPost.media_external_source),
              externalId: firstPost.media_external_id || '',
              externalSource: firstPost.media_external_source || ''
            }],
            groupedActivities: activities,
            activityCount: activities.length
          });
        }
      });

      // Transform non-media posts (regular posts without media)
      // SKIP predictions, polls, and trivia - they're included separately in transformedPredictions with proper data
      // Filter out ALL polls/predictions regardless of prediction_pool_id to avoid duplicates
      // But KEEP rank_share posts - they need special handling
      const transformedNonMediaPosts = nonMediaPosts
        .filter(post => post.post_type !== 'prediction' && post.post_type !== 'poll' && post.post_type !== 'trivia')
        .map(post => {
        const postUser = userMap.get(post.user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
        
        const hasMedia = post.media_title && post.media_title.trim() !== '';
        
        // Get rank data for rank_share posts
        const rankData = post.rank_id ? rankDataMap.get(post.rank_id) : null;
        
        // For rank_share posts, return special structure with rankData
        if (post.post_type === 'rank_share' && rankData) {
          console.log('DEBUG rank_share post:', post.id, 'rankId:', post.rank_id, 'rankData items:', rankData.items?.length);
          return {
            id: post.id,
            type: 'rank_share',
            user: {
              id: post.user_id,
              username: postUser.user_name || 'Unknown',
              displayName: postUser.display_name || postUser.user_name || 'Unknown',
              avatar: postUser.avatar || '',
              email: postUser.email || ''
            },
            content: post.content || '',
            timestamp: post.created_at,
            likes: post.likes_count || 0,
            comments: post.comments_count || 0,
            shares: 0,
            likedByCurrentUser: likedPostIds.has(post.id),
            rankId: post.rank_id,
            rankData: rankData,
            mediaItems: []
          };
        }
        
        // Get list data if post has list_id - use stored list_id or inferred from content
        const effectiveListId = post.list_id || postToListIdMap.get(post.id);
        const listData = effectiveListId ? listDataMap.get(effectiveListId) : null;
        
        return {
          id: post.id,
          type: post.post_type || 'update',
          user: {
            id: post.user_id,
            username: postUser.user_name || 'Unknown',
            displayName: postUser.display_name || postUser.user_name || 'Unknown',
            avatar: postUser.avatar || ''
          },
          content: post.content || '',
          timestamp: post.created_at,
          likes: post.likes_count || 0,
          comments: post.comments_count || 0,
          shares: 0,
          likedByCurrentUser: likedPostIds.has(post.id),
          containsSpoilers: post.contains_spoilers || false,
          rating: post.rating,
          progress: post.progress,
          rankId: post.rank_id || null,
          rankData: rankData || null,
          listId: effectiveListId || null,
          listData: listData ? {
            title: listData.title,
            items: listData.items.map(item => ({
              id: item.id,
              title: item.title,
              mediaType: item.media_type,
              creator: item.creator,
              imageUrl: item.image_url,
              externalId: item.external_id,
              externalSource: item.external_source
            })),
            totalCount: listData.totalCount
          } : null,
          mediaItems: hasMedia ? [{
            id: `embedded_${post.id}`,
            title: post.media_title,
            creator: post.media_creator || '',
            mediaType: post.media_type || '',
            imageUrl: ensureImageUrl(post.image_url, post.media_external_id, post.media_external_source),
            rating: post.rating,
            externalId: post.media_external_id || '',
            externalSource: post.media_external_source || '',
            description: post.media_description || ''
          }] : []
        };
      }) || [];

      // Transform predictions into feed items
      const transformedPredictions = (predictions || []).map((pred: any) => {
        const creatorUser = userMap.get(pred.origin_user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
        const invitedUser = pred.invited_user_id ? (userMap.get(pred.invited_user_id) || null) : null;

        // Calculate vote percentages for this prediction
        const poolVotes = voteCounts[pred.id] || {};
        const totalVotes = Object.values(poolVotes).reduce((sum: number, count: number) => sum + count, 0);
        
        const optionVotes = (pred.options || []).map((opt: string) => {
          const count = poolVotes[opt] || 0;
          const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          return {
            option: opt,
            count,
            percentage
          };
        });

        // Check if current user has already voted on this prediction
        const userHasAnswered = userVotedPoolIds.has(pred.id);

        return {
          id: pred.id,
          type: 'prediction',
          poolType: pred.type || 'predict',
          poolId: pred.id,
          question: pred.title,
          description: pred.description,
          status: pred.status,
          options: pred.options || [],
          optionVotes,
          userVotes: userVoteDetails[pred.id] || [],
          origin_type: pred.origin_type || 'user',
          origin_user_id: pred.origin_user_id,
          creator: {
            id: pred.origin_user_id,
            username: creatorUser.user_name || 'Unknown',
            displayName: creatorUser.display_name || creatorUser.user_name || 'Unknown',
            avatar: creatorUser.avatar || ''
          },
          invitedFriend: invitedUser ? {
            id: pred.invited_user_id,
            username: invitedUser.user_name || 'Unknown',
            displayName: invitedUser.display_name || invitedUser.user_name || 'Unknown'
          } : null,
          timestamp: pred.created_at,
          likes: pred.likes_count || 0,
          comments: pred.comments_count || 0,
          participantCount: totalVotes,
          userHasAnswered,
          voteCounts: {
            yes: poolVotes['Yes'] || 0,
            no: poolVotes['No'] || 0,
            total: totalVotes
          },
          mediaExternalId: pred.media_external_id,
          mediaExternalSource: pred.media_external_source,
          mediaTitle: poolMediaTitleMap.get(pred.id) || null,
          // Add mediaItems for the prediction card to display media info
          mediaItems: poolMediaDataMap.has(pred.id) ? [{
            id: `pred-media-${pred.id}`,
            title: poolMediaDataMap.get(pred.id).title || '',
            mediaType: poolMediaDataMap.get(pred.id).mediaType || '',
            externalId: poolMediaDataMap.get(pred.id).externalId || pred.media_external_id || '',
            externalSource: poolMediaDataMap.get(pred.id).externalSource || pred.media_external_source || '',
            imageUrl: poolMediaDataMap.get(pred.id).imageUrl || '',
            creator: poolMediaDataMap.get(pred.id).creator || ''
          }] : [],
          // Add isLiked status for predictions
          isLiked: likedPredictionIds.has(pred.id)
        };
      }) || [];

      // Combine all items (grouped media, non-media posts, and predictions) and sort by timestamp
      const allItems = [...groupedItems, ...transformedNonMediaPosts, ...transformedPredictions].sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime; // Most recent first
      });

      console.log('Returning items:', allItems.length);
      console.log('Grouped media items:', groupedItems.length);
      console.log('Non-media posts:', transformedNonMediaPosts.length);
      console.log('Predictions:', transformedPredictions.length);

      // Return response with current user's app user ID for delete button matching
      return new Response(JSON.stringify({ 
        posts: allItems, 
        currentUserId: appUser.id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { content, media_title, media_type, media_creator, media_image_url, rating, progress, post_type } = body;

      console.log('Creating post:', { content, media_title, media_type, media_creator, media_image_url, rating, progress, post_type });

      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          content: content || '',
          post_type: post_type || 'update',
          rating: rating || null,
          progress: progress || null,
          likes_count: 0,
          comments_count: 0,
          media_title: media_title || null,
          media_type: media_type || null,
          media_creator: media_creator || null,
          image_url: media_image_url || null,
          media_external_id: null,
          media_external_source: null,
          media_description: null
        })
        .select('id')
        .single();

      if (error) {
        console.log('Failed to create post:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Created post:', post);
      return new Response(JSON.stringify({ post }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
