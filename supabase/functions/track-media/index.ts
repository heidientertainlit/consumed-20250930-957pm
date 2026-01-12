import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper function to fetch poster URL from TMDB when not provided
async function fetchTmdbPosterUrl(externalId: string | null, externalSource: string | null, mediaType?: string, title?: string): Promise<string | null> {
  const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbApiKey) {
    console.log('TMDB_API_KEY not available for poster fetch');
    return null;
  }
  
  try {
    const isTmdbSource = !externalSource || externalSource === 'tmdb' || externalSource === 'movie' || externalSource === 'tv';
    const tryMovie = !mediaType || mediaType === 'movie';
    const tryTv = !mediaType || mediaType === 'tv';
    
    // Try by external ID first if we have one
    if (externalId && isTmdbSource) {
      if (tryMovie) {
        const response = await fetch(`https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbApiKey}`);
        if (response.ok) {
          const data = await response.json();
          if (data.poster_path) {
            return `https://image.tmdb.org/t/p/w300${data.poster_path}`;
          }
        }
      }
      
      if (tryTv) {
        const response = await fetch(`https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbApiKey}`);
        if (response.ok) {
          const data = await response.json();
          if (data.poster_path) {
            return `https://image.tmdb.org/t/p/w300${data.poster_path}`;
          }
        }
      }
    }
    
    // Fallback: search by title if no externalId or ID lookup failed
    if (title && isTmdbSource) {
      console.log('TMDB title search for:', title);
      
      if (tryTv) {
        const response = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}&page=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.results?.[0]?.poster_path) {
            console.log('Found TV poster for:', title);
            return `https://image.tmdb.org/t/p/w300${data.results[0].poster_path}`;
          }
        }
      }
      
      if (tryMovie) {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}&page=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.results?.[0]?.poster_path) {
            console.log('Found movie poster for:', title);
            return `https://image.tmdb.org/t/p/w300${data.results[0].poster_path}`;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching TMDB poster:', error);
  }
  
  return null;
}

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

    console.log('Auth user:', user.email);

    // Look up app user by email, CREATE if doesn't exist
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    console.log('User lookup result:', { appUser, appUserError });

    // If user doesn't exist, create them
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      
      // Use service role to bypass RLS for user creation
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
          display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || ''
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        console.error('Failed to create user:', createError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
      console.log('Created new user:', appUser);

      // Create personal system lists for new user (idempotent)
      const systemLists = [
        'Currently',
        'Want To',
        'Finished',
        'Did Not Finish',
        'Favorites'
      ];

      // Use individual inserts with error handling for idempotency
      for (const listTitle of systemLists) {
        const { error: listError } = await supabaseAdmin
          .from('lists')
          .insert({
            user_id: newUser.id,
            title: listTitle,
            is_default: true,
            is_private: false
          })
          .select('id, title, is_default, is_private')
          .maybeSingle();
        
        // Ignore duplicate key errors (23505), fail on others
        if (listError && listError.code !== '23505') {
          console.error(`Failed to create ${listTitle} list:`, listError);
          return new Response(JSON.stringify({ 
            error: `Failed to create system list ${listTitle}: ${listError.message}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      console.log('Created personal system lists for new user');
    } else if (appUserError) {
      console.error('User lookup error:', appUserError);
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse the request body
    const requestBody = await req.json();
    const { media, rating, review, listType, skip_social_post, rewatchCount, containsSpoilers, privateMode } = requestBody;
    const { title, mediaType, mediaSubtype, creator, imageUrl, externalId, externalSource, seasonNumber, episodeNumber, episodeTitle } = media || {};

    let targetList = null;

    if (listType && listType !== 'all') {
      // Check if listType is a UUID (direct list ID) or a slug
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(listType);

      if (isUuid) {
        // listType is a UUID - look up list directly by ID
        console.log('Looking for list by ID:', listType);
        const { data: listById, error: listError } = await supabase
          .from('lists')
          .select('id, title')
          .eq('id', listType)
          .eq('user_id', appUser.id)
          .maybeSingle();

        console.log('List by ID lookup result:', { listById, listError });

        if (listError || !listById) {
          console.error('List not found by ID:', listError);
          return new Response(JSON.stringify({
            error: `List not found`
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        targetList = listById;
      } else {
        // listType is a slug - map to list title
        const listTitleMapping: Record<string, string> = {
          'currently': 'Currently',
          'finished': 'Finished', 
          'dnf': 'Did Not Finish',
          'queue': 'Want To',
          'favorites': 'Favorites'
        };

        const listTitle = listTitleMapping[listType] || listType;
        console.log('Looking for personal list with title:', listTitle);

        // Find USER'S personal list by title
        const { data: systemList, error: listError } = await supabase
          .from('lists')
          .select('id, title')
          .eq('user_id', appUser.id)
          .eq('title', listTitle)
          .limit(1)
          .maybeSingle();

        console.log('System list lookup result:', { systemList, listError });

        if (listError || !systemList) {
          console.error('System list not found:', listError);
          return new Response(JSON.stringify({
            error: `List "${listTitle}" not found`
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        targetList = systemList;
      }
    }

    // Use admin client for insert to bypass RLS (matching add-media-to-list pattern)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // CRITICAL: Ensure we have a poster image URL before inserting
    // This prevents the "random stock image" bug in the activity feed
    let finalImageUrl = imageUrl || null;
    if (!finalImageUrl) {
      console.log('No image URL provided, fetching from TMDB for:', title);
      finalImageUrl = await fetchTmdbPosterUrl(externalId, externalSource, mediaType, title);
      if (finalImageUrl) {
        console.log('Fetched poster URL:', finalImageUrl);
      } else {
        console.log('Could not fetch poster URL for:', title);
      }
    }

    // Insert the media item with core columns only (matching add-media-to-list)
    const { data: mediaItem, error: mediaError } = await supabaseAdmin
      .from('list_items')
      .insert({
        list_id: targetList?.id || null,
        user_id: appUser.id,
        title: title || 'Untitled',
        media_type: mediaType || 'mixed',
        creator: creator || '',
        image_url: finalImageUrl,
        external_id: externalId || null,
        external_source: externalSource || 'tmdb'
      })
      .select()
      .single();

    // Variable to track if we should create a social post
    let shouldCreatePost = true;
    let actualMediaItem = mediaItem;
    
    if (mediaError) {
      // Handle duplicate key error gracefully (23505 = duplicate key violation)
      if (mediaError.code === '23505') {
        console.log('Media item already exists in this list');
        
        // Fetch the existing item
        const { data: existingItem } = await supabase
          .from('list_items')
          .select()
          .eq('user_id', appUser.id)
          .eq('list_id', targetList?.id || null)
          .eq('external_id', externalId)
          .eq('external_source', externalSource)
          .maybeSingle();
        
        actualMediaItem = existingItem;
        // Still create a social post if user is adding a review/rating
        // Only skip if there's no new content to post
        if (!review && !rating) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Item already in list',
            item: existingItem
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        console.log('Item exists but user is adding review/rating, will create social post');
      } else {
        console.error('Error adding media item:', mediaError);
        return new Response(JSON.stringify({
          error: 'Failed to add media item: ' + mediaError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log('Successfully processed media item:', actualMediaItem);

    // Create a social post for this addition (skip if caller will handle it, e.g. when rating is also being added)
    if (actualMediaItem && !skip_social_post) {
      try {
        // Determine post type based on rewatch count
        // Note: We use 'add-to-list' even when rating is provided - rating is included in the post data
        // This ensures "Currently" list additions show as "is currently consuming" WITH rating, not separate posts
        const isRewatch = rewatchCount && rewatchCount > 1;
        const postType = isRewatch ? 'rewatch' : 'add-to-list';
        
        // Format ordinal suffix for rewatch count
        const getOrdinalSuffix = (n: number): string => {
          const s = ["th", "st", "nd", "rd"];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };
        
        // Generate content based on post type
        // Use user's review if provided, otherwise generate appropriate content
        let content: string | null;
        if (review && review.trim()) {
          // User provided a review - use it as the content
          content = review.trim();
        } else if (isRewatch) {
          content = `is consuming ${title} for the ${getOrdinalSuffix(rewatchCount)} time`;
        } else {
          // No redundant text for simple list additions - the media card is enough
          content = null;
        }
        
        // Use finalImageUrl from earlier fetch (already populated before list_items insert)
        // Use admin client to bypass RLS for social post creation (matching add-media-to-list pattern)
        const { error: postError } = await supabaseAdmin
          .from('social_posts')
          .insert({
            user_id: appUser.id,
            post_type: postType,
            list_id: targetList?.id || null,
            content,
            media_title: title,
            media_type: mediaType,
            media_creator: creator,
            image_url: finalImageUrl,
            media_external_id: externalId,
            media_external_source: externalSource,
            rating: rating || null,
            contains_spoilers: containsSpoilers || false
          });
        
        if (postError) {
          console.error('Failed to create social post:', postError);
          // Don't fail the whole request if post creation fails
        } else {
          console.log('Created social post for list addition with post_type:', postType, 'content:', content ? 'yes' : 'no');
        }
      } catch (postCreateError) {
        console.error('Error creating social post:', postCreateError);
      }
    } else if (skip_social_post) {
      console.log('Skipping social post creation (skip_social_post=true)');
    }

    // Also save rating to unified media_ratings table for Entertainment DNA
    if (rating && externalId && externalSource && title && mediaType) {
      console.log('Saving rating to media_ratings table...');
      
      // Check if rating already exists
      const { data: existingRating } = await supabase
        .from('media_ratings')
        .select('id')
        .eq('user_id', appUser.id)
        .eq('media_external_id', externalId)
        .eq('media_external_source', externalSource)
        .maybeSingle();

      if (existingRating) {
        // Update existing rating
        const { error: updateError } = await supabase
          .from('media_ratings')
          .update({
            rating,
            media_title: title,
            media_type: mediaType,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRating.id);

        if (updateError) {
          console.error('Failed to update media_ratings:', updateError);
        } else {
          console.log('Updated existing rating in media_ratings');
        }
      } else {
        // Create new rating
        const { error: insertError } = await supabase
          .from('media_ratings')
          .insert({
            user_id: appUser.id,
            media_external_id: externalId,
            media_external_source: externalSource,
            media_title: title,
            media_type: mediaType,
            rating
          });

        if (insertError) {
          console.error('Failed to insert into media_ratings:', insertError);
        } else {
          console.log('Created new rating in media_ratings');
        }
      }
    }

    // Check if this is user's first item and award referral bonus to referrer
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get full user record to check referral status
      const { data: fullUser } = await supabaseAdmin
        .from('users')
        .select('referred_by, referral_rewarded')
        .eq('id', appUser.id)
        .single();

      // If user was referred and hasn't been marked as rewarded yet
      if (fullUser?.referred_by && !fullUser?.referral_rewarded) {
        // Count user's total items to see if this is their first
        const { count } = await supabaseAdmin
          .from('list_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', appUser.id);

        // If this is their first item (count is 1 after insert)
        if (count === 1) {
          console.log('First item logged! Awarding referral bonus to:', fullUser.referred_by);
          
          // Mark the referral as rewarded
          await supabaseAdmin
            .from('users')
            .update({ referral_rewarded: true })
            .eq('id', appUser.id);
          
          console.log('Referral reward marked for user:', appUser.id);
        }
      }
    } catch (referralError) {
      console.error('Referral check error (non-fatal):', referralError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: mediaItem,
      listTitle: targetList?.title || 'All'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Track media error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
