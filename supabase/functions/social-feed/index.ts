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
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
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
      console.log('Getting social posts...');
      
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
          list_id,
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
          contains_spoilers
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

      const userIds = [...new Set(posts?.map(post => post.user_id) || [])];
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, user_name, display_name, email, avatar')
        .in('id', userIds);

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

      // Fetch list items for posts that have list_id (for list preview)
      const listIds = [...new Set(posts?.map(post => post.list_id).filter(Boolean) || [])];
      let listItemsMap = new Map();
      
      if (listIds.length > 0) {
        const { data: listItems } = await supabase
          .from('list_items')
          .select('list_id, media_title, media_type, media_creator, media_image_url, media_external_id, media_external_source')
          .in('list_id', listIds)
          .order('created_at', { ascending: false })
          .limit(200); // Fetch up to 200 items total
        
        // Group list items by list_id
        listItems?.forEach(item => {
          if (!listItemsMap.has(item.list_id)) {
            listItemsMap.set(item.list_id, []);
          }
          listItemsMap.get(item.list_id).push(item);
        });
      }

      // Fetch prediction data for posts with type 'prediction'
      const predictionPostIds = posts?.filter(p => p.post_type === 'prediction').map(p => p.user_id) || [];
      let predictionDataMap = new Map();
      
      if (predictionPostIds.length > 0) {
        const { data: predictionPools } = await supabase
          .from('prediction_pools')
          .select('*')
          .in('origin_user_id', predictionPostIds)
          .eq('status', 'open')
          .order('created_at', { ascending: false });
        
        // Get vote counts for predictions
        const poolIds = predictionPools?.map(p => p.id) || [];
        const { data: votes } = await supabase
          .from('user_predictions')
          .select('pool_id, prediction')
          .in('pool_id', poolIds);
        
        const voteCountsMap = new Map();
        votes?.forEach(v => {
          if (!voteCountsMap.has(v.pool_id)) {
            voteCountsMap.set(v.pool_id, {});
          }
          const counts = voteCountsMap.get(v.pool_id);
          counts[v.prediction] = (counts[v.prediction] || 0) + 1;
        });
        
        // Check user's votes
        const { data: userVotes } = await supabase
          .from('user_predictions')
          .select('pool_id')
          .eq('user_id', appUser.id)
          .in('pool_id', poolIds);
        
        const votedPoolIds = new Set(userVotes?.map(v => v.pool_id) || []);
        
        // Map predictions by user_id for easy lookup
        predictionPools?.forEach(pred => {
          const voteCounts = voteCountsMap.get(pred.id) || {};
          const totalVotes = Object.values(voteCounts).reduce((sum: number, count: any) => sum + (count as number), 0) as number;
          
          predictionDataMap.set(pred.origin_user_id, {
            poolId: pred.id,
            question: pred.question,
            options: pred.options || [],
            optionVotes: (pred.options || []).map((option: string) => ({
              option,
              count: voteCounts[option] || 0,
              percentage: totalVotes > 0 ? Math.round(((voteCounts[option] || 0) / totalVotes) * 100) : 0
            })),
            userHasAnswered: votedPoolIds.has(pred.id),
            voteCounts: {
              yes: voteCounts[pred.options?.[0]] || 0,
              no: voteCounts[pred.options?.[1]] || 0,
              total: totalVotes
            },
            origin_type: pred.origin_type,
            creatorPrediction: pred.options?.[0] || '',
            friendPrediction: pred.options?.[1]
          });
        });
      }

      const transformedPosts = posts?.map(post => {
        const postUser = userMap.get(post.user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
        
        const hasMedia = post.media_title && post.media_title.trim() !== '';
        
        // Get list items for preview (up to 4 items)
        let listPreview = [];
        if (post.list_id && listItemsMap.has(post.list_id)) {
          const items = listItemsMap.get(post.list_id);
          listPreview = items.slice(0, 4).map(item => ({
            id: item.id || '',
            title: item.media_title || '',
            creator: item.media_creator || '',
            mediaType: item.media_type || '',
            imageUrl: item.media_image_url || '',
            externalId: item.media_external_id || '',
            externalSource: item.media_external_source || ''
          }));
        }
        
        // Enrich prediction posts with prediction_pools data
        const predictionData = post.post_type === 'prediction' ? predictionDataMap.get(post.user_id) : null;
        
        const basePost = {
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
          listPreview: listPreview.length > 0 ? listPreview : undefined,
          mediaItems: hasMedia ? [{
            id: `embedded_${post.id}`,
            title: post.media_title,
            creator: post.media_creator || '',
            mediaType: post.media_type || '',
            imageUrl: post.image_url || '',
            rating: post.rating,
            externalId: post.media_external_id || '',
            externalSource: post.media_external_source || '',
            description: post.media_description || ''
          }] : []
        };
        
        // Add prediction fields if this is a prediction post
        if (predictionData) {
          return {
            ...basePost,
            ...predictionData,
            creator: {
              username: postUser.user_name || 'Unknown'
            },
            invitedFriend: {
              username: 'everyone'
            }
          };
        }
        
        return basePost;
      }) || [];

      console.log('Returning posts:', transformedPosts.length);
      console.log('Posts with media:', transformedPosts.filter(p => p.mediaItems.length > 0).length);

      // Fetch predictions from prediction_pools
      const { data: predictions, error: predictionsError } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .range(0, limit + offset - 1); // Fetch extra to mix with posts

      console.log('Found predictions:', predictions?.length || 0);

      // Get vote counts for each prediction
      const predictionIds = predictions?.map(p => p.id) || [];
      const { data: userPredictions } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .in('pool_id', predictionIds);

      // Calculate vote counts
      const voteCountsMap = new Map();
      userPredictions?.forEach(up => {
        if (!voteCountsMap.has(up.pool_id)) {
          voteCountsMap.set(up.pool_id, {});
        }
        const counts = voteCountsMap.get(up.pool_id);
        counts[up.prediction] = (counts[up.prediction] || 0) + 1;
      });

      // Check which predictions the current user has voted on
      const { data: currentUserPredictions } = await supabase
        .from('user_predictions')
        .select('pool_id')
        .eq('user_id', appUser.id)
        .in('pool_id', predictionIds);

      const votedPoolIds = new Set(currentUserPredictions?.map(up => up.pool_id) || []);

      // Get user info for prediction creators
      const creatorIds = [...new Set(predictions?.map(p => p.origin_user_id).filter(Boolean) || [])];
      const { data: creators } = await supabase
        .from('users')
        .select('id, user_name, display_name')
        .in('id', creatorIds);

      const creatorMap = new Map(creators?.map(c => [c.id, c]) || []);

      // Transform predictions into feed items
      const transformedPredictions = predictions?.map(pred => {
        const creator = creatorMap.get(pred.origin_user_id) || { id: 'consumed', user_name: 'consumed', display_name: 'consumed' };
        const voteCounts = voteCountsMap.get(pred.id) || {};
        const totalVotes = Object.values(voteCounts).reduce((sum: number, count: any) => sum + (count as number), 0) as number;
        
        // Calculate percentages for each option
        const optionVotes = (pred.options || []).map((option: string) => ({
          option,
          count: voteCounts[option] || 0,
          percentage: totalVotes > 0 ? Math.round(((voteCounts[option] || 0) / totalVotes) * 100) : 0
        }));

        return {
          id: pred.id,
          type: 'prediction',
          user: {
            id: creator.id || pred.origin_user_id || '',
            username: creator.user_name || 'consumed',
            displayName: creator.display_name || creator.user_name || 'consumed',
            avatar: ''
          },
          content: pred.question || '',
          poolId: pred.id,
          question: pred.question,
          options: pred.options || [],
          optionVotes,
          mediaItems: [],
          creator: {
            username: creator.user_name
          },
          invitedFriend: {
            username: 'everyone'
          },
          creatorPrediction: pred.options?.[0] || '',
          friendPrediction: pred.options?.[1],
          userHasAnswered: votedPoolIds.has(pred.id),
          participantCount: totalVotes,
          voteCounts: {
            yes: voteCounts[pred.options?.[0]] || 0,
            no: voteCounts[pred.options?.[1]] || 0,
            total: totalVotes
          },
          origin_type: pred.origin_type,
          origin_user_id: pred.origin_user_id,
          timestamp: pred.created_at,
          likes: 0,
          comments: 0,
          likedByCurrentUser: false
        };
      }) || [];

      // Merge posts and predictions, sort by timestamp
      const allItems = [...transformedPosts, ...transformedPredictions]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(offset, offset + limit);

      console.log('Returning items:', allItems.length, '(posts + predictions)');

      return new Response(JSON.stringify(allItems), {
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
