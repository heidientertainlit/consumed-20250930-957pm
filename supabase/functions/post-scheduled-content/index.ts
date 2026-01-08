import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const now = new Date().toISOString();
    console.log('Checking for scheduled posts due at:', now);

    const { data: duePosts, error: fetchError } = await supabaseAdmin
      .from('scheduled_persona_posts')
      .select('*')
      .eq('posted', false)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching scheduled posts:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!duePosts || duePosts.length === 0) {
      console.log('No scheduled posts due');
      return new Response(JSON.stringify({ 
        message: 'No scheduled posts due',
        processed: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Found', duePosts.length, 'posts to publish');

    const results: { id: string; success: boolean; postId?: string; error?: string }[] = [];

    for (const scheduledPost of duePosts) {
      try {
        const { data: newPost, error: insertError } = await supabaseAdmin
          .from('social_posts')
          .insert({
            user_id: scheduledPost.persona_user_id,
            post_type: scheduledPost.post_type,
            content: scheduledPost.content,
            rating: scheduledPost.rating,
            media_title: scheduledPost.media_title,
            media_type: scheduledPost.media_type,
            media_creator: scheduledPost.media_creator,
            image_url: scheduledPost.image_url,
            media_external_id: scheduledPost.media_external_id,
            media_external_source: scheduledPost.media_external_source,
            media_description: scheduledPost.media_description,
            contains_spoilers: scheduledPost.contains_spoilers,
            visibility: 'public',
            likes_count: 0,
            comments_count: 0,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error inserting post:', insertError);
          results.push({ id: scheduledPost.id, success: false, error: insertError.message });
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('scheduled_persona_posts')
          .update({
            posted: true,
            posted_at: now,
            resulting_post_id: newPost.id,
          })
          .eq('id', scheduledPost.id);

        if (updateError) {
          console.error('Error updating scheduled post:', updateError);
          results.push({ id: scheduledPost.id, success: false, error: updateError.message });
        } else {
          console.log('Successfully posted:', scheduledPost.id, '→', newPost.id);
          results.push({ id: scheduledPost.id, success: true, postId: newPost.id });
        }
      } catch (err) {
        console.error('Unexpected error processing post:', err);
        results.push({ id: scheduledPost.id, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log('Finished processing:', successCount, '/', duePosts.length, 'successful');

    return new Response(JSON.stringify({
      message: `Processed ${duePosts.length} scheduled posts`,
      processed: duePosts.length,
      successful: successCount,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
