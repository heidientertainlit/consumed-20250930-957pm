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

      // If this post has a prediction_pool_id, delete votes first, then the pool
      if (post.prediction_pool_id) {
        // First delete all votes/predictions for this pool
        const { error: votesError } = await serviceSupabase
          .from('user_predictions')
          .delete()
          .eq('pool_id', post.prediction_pool_id);
        
        if (votesError) {
          console.error('Error deleting user predictions:', votesError);
        }

        // Then delete the prediction pool
        const { error: poolError } = await serviceSupabase
          .from('prediction_pools')
          .delete()
          .eq('id', post.prediction_pool_id);
        
        if (poolError) {
          console.error('Error deleting prediction pool:', poolError);
          // Continue to delete the post even if pool deletion fails
        }
      }

      // First, verify the post still exists before deletion
      const { data: postBeforeDelete } = await serviceSupabase
        .from('social_posts')
        .select('id, user_id')
        .eq('id', post_id)
        .single();
      
      console.log('Post before delete:', postBeforeDelete);

      if (!postBeforeDelete) {
        console.log('Post already deleted or does not exist');
        return new Response(JSON.stringify({ success: true, message: 'Post already deleted' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete the post with .select() to get deleted rows back
      console.log('Attempting to delete post:', post_id, 'owned by:', postBeforeDelete.user_id);
      
      const { data: deletedRows, error } = await serviceSupabase
        .from('social_posts')
        .delete()
        .eq('id', post_id)
        .select();

      if (error) {
        console.error('Delete error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Delete result - rows deleted:', deletedRows?.length || 0);
      
      if (!deletedRows || deletedRows.length === 0) {
        console.error('No rows were deleted - post may have already been removed');
        // Still return success since the post is gone
        return new Response(JSON.stringify({ success: true, message: 'Post already deleted or not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Post deleted successfully:', deletedRows[0]);
      return new Response(JSON.stringify({ success: true, deleted_post_id: post_id, deleted: deletedRows[0] }), {
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
