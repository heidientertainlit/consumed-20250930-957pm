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

    let { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { question, options } = await req.json();
    
    const filledOptions = options ? options.filter((o: string) => o && o.trim()) : ['Yes', 'No'];

    if (!question || filledOptions.length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert poll
    const { data: pool, error: poolError } = await supabase
      .from('prediction_pools')
      .insert({
        id: crypto.randomUUID(),
        title: question.substring(0, 100),
        description: question,
        type: 'vote',
        status: 'open',
        category: 'movie',
        icon: '🗳️',
        points_reward: 10,
        options: filledOptions,
        origin_type: 'user',
        origin_user_id: appUser.id,
        likes_count: 0,
        comments_count: 0,
        participants: 0
      })
      .select()
      .single();

    if (poolError) {
      console.error('Pool error:', poolError);
      return new Response(JSON.stringify({ error: 'Pool creation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert social post
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        user_id: appUser.id,
        content: question,
        post_type: 'poll',
        prediction_pool_id: pool.id,
        media_title: question.substring(0, 100),
        media_type: 'Movie',
        contains_spoilers: false
      })
      .select()
      .single();

    if (postError) {
      console.error('Post error:', postError);
      return new Response(JSON.stringify({ error: 'Post creation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, pool, post }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
