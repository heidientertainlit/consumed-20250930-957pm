import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, DELETE, POST'
};

serve(async (req) => {
  console.log('social-feed-delete invoked, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.log('No authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('User lookup result:', user?.email, 'error:', userError?.message);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method !== 'DELETE' && req.method !== 'POST') {
      return new Response(JSON.stringify({ error: `Method ${req.method} not allowed. Use DELETE or POST.` }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { post_id } = body;
    console.log('Received post_id:', post_id);

    if (!post_id) {
      return new Response(JSON.stringify({ error: 'Missing post_id in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: appUser, error: appUserError } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();

    console.log('App user lookup:', appUser?.id, 'error:', appUserError?.message);

    if (appUserError || !appUser) {
      return new Response(JSON.stringify({ error: 'User not found in app database' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: post, error: postError } = await serviceSupabase
      .from('social_posts')
      .select('user_id, prediction_pool_id')
      .eq('id', post_id)
      .single();

    console.log('Post lookup:', post?.user_id, 'error:', postError?.message);

    if (postError || !post) {
      return new Response(JSON.stringify({ error: 'Post not found', post_id }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Ownership check: post.user_id=', post.user_id, 'appUser.id=', appUser.id);
    
    if (post.user_id !== appUser.id) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - you can only delete your own posts',
        post_owner: post.user_id,
        requesting_user: appUser.id
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (post.prediction_pool_id) {
      console.log('Deleting prediction pool:', post.prediction_pool_id);
      
      const { error: votesError } = await serviceSupabase
        .from('user_predictions')
        .delete()
        .eq('pool_id', post.prediction_pool_id);
      
      if (votesError) console.error('Error deleting votes:', votesError);

      const { error: poolError } = await serviceSupabase
        .from('prediction_pools')
        .delete()
        .eq('id', post.prediction_pool_id);
      
      if (poolError) console.error('Error deleting pool:', poolError);
    }

    console.log('Deleting post:', post_id);
    
    const { data: deletedRows, error: deleteError } = await serviceSupabase
      .from('social_posts')
      .delete()
      .eq('id', post_id)
      .select();

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Delete result - rows:', deletedRows?.length || 0);
    
    return new Response(JSON.stringify({ 
      success: true, 
      deleted_post_id: post_id,
      rows_deleted: deletedRows?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Caught exception:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
