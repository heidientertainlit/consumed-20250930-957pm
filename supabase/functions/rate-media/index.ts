import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper function to fetch poster URL from TMDB when not provided
async function fetchTmdbPosterUrl(externalId: string | null, externalSource: string | null, mediaType?: string): Promise<string | null> {
  if (!externalId || (externalSource !== 'tmdb' && externalSource !== 'movie' && externalSource !== 'tv')) return null;
  
  const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbApiKey) return null;
  
  try {
    const tryMovie = !mediaType || mediaType === 'movie';
    const tryTv = !mediaType || mediaType === 'tv';
    
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

    // Look up app user by email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    console.log('User lookup result:', { appUser, appUserError });

    // If user doesn't exist, create them
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      
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
    const body = await req.json();
    const { 
      media_external_id,
      media_external_source,
      media_title,
      media_type,
      rating,
      skip_social_post,
      review_content,
      contains_spoilers
    } = body;

    console.log('Rating request:', {
      userId: appUser.id,
      mediaExternalId: media_external_id,
      mediaExternalSource: media_external_source,
      mediaTitle: media_title,
      mediaType: media_type,
      rating
    });

    // Validate input
    if (!media_external_id || !media_external_source || !media_title || !media_type || !rating) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: media_external_id, media_external_source, media_title, media_type, rating' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rating < 0.5 || rating > 5) {
      return new Response(JSON.stringify({ 
        error: 'Rating must be between 0.5 and 5' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user has already rated this media
    const { data: existingRating, error: checkError } = await supabase
      .from('media_ratings')
      .select('id')
      .eq('user_id', appUser.id)
      .eq('media_external_id', media_external_id)
      .eq('media_external_source', media_external_source)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing rating:', checkError);
      return new Response(JSON.stringify({ 
        error: 'Failed to check existing rating: ' + checkError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let result;
    if (existingRating) {
      // Update existing rating
      console.log('Updating existing rating:', existingRating.id);
      const { data, error } = await supabase
        .from('media_ratings')
        .update({
          rating,
          media_title,
          media_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRating.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating rating:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to update rating: ' + error.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      result = data;
    } else {
      // Create new rating
      console.log('Creating new rating');
      const { data, error } = await supabase
        .from('media_ratings')
        .insert({
          user_id: appUser.id,
          media_external_id,
          media_external_source,
          media_title,
          media_type,
          rating
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating rating:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to create rating: ' + error.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      result = data;
    }

    console.log('Rating saved successfully:', result);

    // Resolve any pending bets on this user + media combination
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Find pending bets for this user on this specific media
      const { data: pendingBets, error: betsError } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('target_user_id', appUser.id)
        .eq('external_id', media_external_id)
        .eq('external_source', media_external_source)
        .eq('status', 'pending');

      if (!betsError && pendingBets && pendingBets.length > 0) {
        console.log(`Found ${pendingBets.length} pending bets to resolve`);
        
        // Rating >= 4 means user liked it, < 4 means disliked
        const userLikedIt = rating >= 4;
        
        for (const bet of pendingBets) {
          const betWon = (bet.prediction === 'will_like' && userLikedIt) || 
                         (bet.prediction === 'will_dislike' && !userLikedIt);
          
          const pointsToAward = betWon ? 5 : 0;
          
          // Update bet status
          await supabaseAdmin
            .from('bets')
            .update({
              status: betWon ? 'won' : 'lost',
              points_awarded: pointsToAward,
              resolved_at: new Date().toISOString()
            })
            .eq('id', bet.id);
          
          // Award points if won
          if (betWon) {
            await supabaseAdmin.rpc('increment_user_points', {
              p_user_id: bet.user_id,
              p_column: 'app_engagement',
              p_amount: pointsToAward
            });
            
            // Send notification to winner
            await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: bet.user_id,
                type: 'bet_won',
                title: 'You won your bet!',
                message: `Your prediction about ${bet.media_title} was correct! +${pointsToAward} points`,
                data: { bet_id: bet.id, media_title: bet.media_title, points: pointsToAward }
              });
          }
          
          console.log(`Bet ${bet.id} resolved: ${betWon ? 'WON' : 'LOST'}`);
        }
      }
    } catch (betResolutionError) {
      console.error('Error resolving bets (non-fatal):', betResolutionError);
    }

    // Create a social post for this rating (skip if user chose private mode)
    if (!skip_social_post) {
      try {
        // If review content is provided, use it as the post content
        // Otherwise, leave content empty (no "Rated X" text for rating-only posts)
        const postContent = review_content?.trim() || null;
        
        // Ensure we have a poster URL - fetch from TMDB if missing
        let finalImageUrl = body.media_image_url || null;
        if (!finalImageUrl && media_external_id && (media_external_source === 'tmdb' || !media_external_source)) {
          console.log('No image URL provided for rating, fetching from TMDB...');
          finalImageUrl = await fetchTmdbPosterUrl(media_external_id, media_external_source || 'tmdb', media_type);
          if (finalImageUrl) {
            console.log('Fetched TMDB poster for rating:', finalImageUrl);
          }
        }
        
        const { error: postError } = await supabase
          .from('social_posts')
          .insert({
            user_id: appUser.id,
            post_type: 'rate-review',
            content: postContent,
            media_title: media_title,
            media_type: media_type,
            media_external_id: media_external_id,
            media_external_source: media_external_source,
            image_url: finalImageUrl,
            rating: rating,
            visibility: 'public',
            contains_spoilers: contains_spoilers || false
          });
        
        if (postError) {
          console.error('Failed to create social post for rating:', postError);
        } else {
          console.log('Created social post for rating', postContent ? 'with review' : 'without review');
        }
      } catch (postCreateError) {
        console.error('Error creating social post:', postCreateError);
      }
    } else {
      console.log('Skipping social post creation (skip_social_post=true, private mode)');
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      rating: result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
