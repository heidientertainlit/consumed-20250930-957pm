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

    if (req.method === 'DELETE') {
      const body = await req.json();
      const { post_id } = body;

      if (!post_id) {
        return new Response(JSON.stringify({ error: 'Missing post_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Use service role to check ownership and delete
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      // Get app user from email to compare with post.user_id
      const { data: appUser, error: appUserError } = await serviceSupabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (appUserError || !appUser) {
        console.error('Failed to get app user:', appUserError);
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if user owns the post
      const { data: post } = await serviceSupabase
        .from('social_posts')
        .select('user_id, prediction_pool_id')
        .eq('id', post_id)
        .single();

      if (!post) {
        return new Response(JSON.stringify({ error: 'Post not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Compare with app user ID, not auth user ID
      if (post.user_id !== appUser.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized - you can only delete your own posts' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If this post has a prediction_pool_id, delete that pool too
      if (post.prediction_pool_id) {
        const { error: poolError } = await serviceSupabase
          .from('prediction_pools')
          .delete()
          .eq('id', post.prediction_pool_id);
        
        if (poolError) {
          console.error('Error deleting prediction pool:', poolError);
          // Continue to delete the post even if pool deletion fails
        }
      }

      // Delete the post (cascading deletes will handle likes and comments)
      const { error } = await serviceSupabase
        .from('social_posts')
        .delete()
        .eq('id', post_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
