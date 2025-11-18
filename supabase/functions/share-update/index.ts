import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

serve(async (req) => {
  // Handle CORS preflight
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
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get or create app user
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      // User doesn't exist, create them
      console.log('Creating new user:', user.email);
      const { data: newUser, error: createError } = await supabase
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

    if (req.method === 'POST') {
      // Create a new social feed post or prediction
      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { type, content, media_title, media_type, media_creator, media_image_url, rating, media_external_id, media_external_source, contains_spoilers, list_id, prediction_question, prediction_options } = body;

      console.log('Creating post for user:', appUser.id);
      console.log('Request body:', body);

      // Handle predictions separately
      if (type === 'prediction' && prediction_question && prediction_options) {
        // Create prediction pool
        const { data: pool, error: poolError } = await supabase
          .from('prediction_pools')
          .insert({
            question: prediction_question,
            options: prediction_options,
            type: 'predict',
            origin_type: 'user',
            origin_user_id: appUser.id,
            status: 'open',
            points_reward: 20,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (poolError) {
          console.error('Prediction pool creation error:', poolError);
          return new Response(JSON.stringify({ error: poolError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('Prediction pool created successfully:', pool.id);

        // ALSO create a social_post linking to this prediction so it appears in feed
        const { data: post, error: postError } = await supabase
          .from('social_posts')
          .insert({
            user_id: appUser.id,
            content: prediction_question,
            post_type: 'prediction',
            contains_spoilers: contains_spoilers || false
          })
          .select()
          .single();

        if (postError) {
          console.error('Post creation error for prediction:', postError);
          // Don't fail completely, prediction was created
        } else {
          console.log('Social post created for prediction:', post.id);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          pool_id: pool.id,
          post_id: post?.id,
          message: 'Prediction created successfully' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Regular social post
      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: appUser.id,
          content,
          list_id: list_id || null,
          media_title,
          media_type,
          media_creator,
          image_url: media_image_url,
          rating,
          media_external_id: media_external_id || null,
          media_external_source: media_external_source || null,
          contains_spoilers: contains_spoilers || false
        })
        .select()
        .single();

      if (error) {
        console.error('Post creation error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Post created successfully:', post.id);

      // Extract @mentions and send notifications
      if (content) {
        // Whitelist pattern: @ must be at start OR preceded by allowed punctuation/whitespace
        // Allows: "@alex", " @alex", ",@alex", "(@alex", "FYI:@alex", "!@alex"
        // Blocks: "user@alex", "http://@alex", "?ref=@alex", "&id=@alex"
        const mentionPattern = /(^|[\s,;:!?(){}\[\]"'<>\-])@([\w.-]+)/g;
        const mentions: string[] = [];
        let match;
        
        while ((match = mentionPattern.exec(content)) !== null) {
          mentions.push(match[2]); // Group 2 is the username (group 1 is delimiter)
        }

        if (mentions.length > 0) {
          console.log('Found mentions:', mentions);
          
          // Look up user IDs for mentioned usernames
          const { data: mentionedUsers } = await supabase
            .from('users')
            .select('id, user_name')
            .in('user_name', mentions);

          if (mentionedUsers && mentionedUsers.length > 0) {
            // Send notification to each mentioned user (excluding post author)
            for (const mentionedUser of mentionedUsers) {
              if (mentionedUser.id !== appUser.id) { // Don't notify if mentioning yourself
                try {
                  const notifResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    },
                    body: JSON.stringify({
                      userId: mentionedUser.id,
                      type: 'mention',
                      triggeredByUserId: appUser.id,
                      message: `${appUser.user_name} mentioned you in a post`,
                      postId: post.id
                    })
                  });
                  
                  if (!notifResponse.ok) {
                    console.error('Failed to send mention notification:', await notifResponse.text());
                  }
                } catch (notifError) {
                  console.error('Error sending mention notification:', notifError);
                }
              }
            }
          }
        }
      }

      // Also save rating to unified media_ratings table for Entertainment DNA
      if (rating && media_external_id && media_external_source && media_title && media_type) {
        console.log('Saving rating to media_ratings table...');
        
        // Check if rating already exists
        const { data: existingRating } = await supabase
          .from('media_ratings')
          .select('id')
          .eq('user_id', appUser.id)
          .eq('media_external_id', media_external_id)
          .eq('media_external_source', media_external_source)
          .maybeSingle();

        if (existingRating) {
          // Update existing rating
          const { error: updateError } = await supabase
            .from('media_ratings')
            .update({
              rating,
              media_title,
              media_type,
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
              media_external_id,
              media_external_source,
              media_title,
              media_type,
              rating
            });

          if (insertError) {
            console.error('Failed to insert into media_ratings:', insertError);
          } else {
            console.log('Created new rating in media_ratings');
          }
        }
      }
      return new Response(JSON.stringify({ post }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Share update function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
