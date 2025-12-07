import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("share-rank function hit!", req.method);
  
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up user by auth UID first, then by email as fallback
    let { data: appUser, error: appUserError } = await supabaseAdmin
      .from('users')
      .select('id, email, user_name, display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!appUser) {
      const { data: emailUser } = await supabaseAdmin
        .from('users')
        .select('id, email, user_name, display_name')
        .eq('email', user.email)
        .maybeSingle();
      
      if (emailUser) appUser = emailUser;
    }

    if (!appUser) {
      return new Response(JSON.stringify({ error: 'User not found in database' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    const { rankId, caption } = requestBody;

    if (!rankId) {
      return new Response(JSON.stringify({ error: 'rankId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the rank with its items
    const { data: rank, error: rankError } = await supabaseAdmin
      .from('ranks')
      .select('id, user_id, title, description, visibility, max_items')
      .eq('id', rankId)
      .single();

    if (rankError || !rank) {
      return new Response(JSON.stringify({ error: 'Rank not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only owner can share their rank
    if (rank.user_id !== appUser.id) {
      return new Response(JSON.stringify({ error: 'You can only share your own ranks' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if rank is private (can't share private ranks)
    if (rank.visibility === 'private') {
      return new Response(JSON.stringify({ error: 'Cannot share private ranks. Change visibility first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if already shared recently (prevent spam)
    const { data: recentShare } = await supabaseAdmin
      .from('social_posts')
      .select('id, created_at')
      .eq('user_id', appUser.id)
      .eq('rank_id', rankId)
      .eq('post_type', 'rank_share')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentShare) {
      const hoursSinceLastShare = (Date.now() - new Date(recentShare.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastShare < 24) {
        return new Response(JSON.stringify({ 
          error: 'You already shared this rank recently. Wait 24 hours before sharing again.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Create the social post
    const postContent = caption || `Check out my ranked list: ${rank.title}`;
    
    const { data: newPost, error: postError } = await supabaseAdmin
      .from('social_posts')
      .insert({
        user_id: appUser.id,
        content: postContent,
        post_type: 'rank_share',
        rank_id: rankId,
        likes_count: 0,
        comments_count: 0
      })
      .select('id, created_at')
      .single();

    if (postError) {
      console.error('Error creating post:', postError);
      return new Response(JSON.stringify({ error: 'Failed to share rank' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Rank ${rankId} shared to feed by ${appUser.user_name}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        postId: newPost.id,
        rankId,
        createdAt: newPost.created_at
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Share rank error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
