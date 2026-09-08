import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  console.log("create-rank function hit!", req.method);
  
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

    let { data: appUser, error: appUserError } = await supabaseAdmin
      .from('users')
      .select('id, email, user_name')
      .eq('id', user.id)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
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
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
    } else if (appUserError) {
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    const { title, description, visibility, isCollaborative, maxItems, category, coverImageUrl, requestId } = requestBody;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (requestId !== undefined && (typeof requestId !== 'string' || !uuidPattern.test(requestId))) {
      return new Response(JSON.stringify({ error: 'requestId must be a valid UUID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const successResponse = (rank) => new Response(JSON.stringify({
      success: true,
      data: rank
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    const conflictResponse = () => new Response(JSON.stringify({
      error: 'Request ID conflict'
    }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    const readRequestedRank = async () => {
      const { data, error } = await supabaseAdmin
        .from('ranks')
        .select()
        .eq('id', requestId)
        .maybeSingle();
      return { data, error };
    };

    if (requestId) {
      const { data: existingRank, error: existingRankError } = await readRequestedRank();
      if (existingRankError) {
        console.error('Error checking existing rank request:', existingRankError);
        return new Response(JSON.stringify({ error: 'Failed to check existing rank request' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (existingRank) {
        return existingRank.user_id === appUser.id
          ? successResponse(existingRank)
          : conflictResponse();
      }
    }

    const rankToInsert = {
      ...(requestId ? { id: requestId } : {}),
      user_id: appUser.id,
      title,
      description: description || null,
      visibility: visibility || 'public',
      is_collaborative: isCollaborative || false,
      max_items: maxItems || 10,
      category: category || 'mixed',
      cover_image_url: coverImageUrl || null
    };

    const { data: rank, error: rankError } = await supabaseAdmin
      .from('ranks')
      .insert(rankToInsert)
      .select()
      .single();

    if (rankError) {
      if (requestId && rankError.code === '23505') {
        const { data: existingRank, error: existingRankError } = await readRequestedRank();
        if (!existingRankError && existingRank) {
          return existingRank.user_id === appUser.id
            ? successResponse(existingRank)
            : conflictResponse();
        }
        if (existingRankError) {
          console.error('Error re-reading conflicting rank request:', existingRankError);
        }
        return conflictResponse();
      }
      console.error('Error creating rank:', rankError);
      return new Response(JSON.stringify({
        error: 'Failed to create rank: ' + rankError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Successfully created rank:', rank.title);

    // Create a social_posts entry so the rank appears in the activity feed
    if ((visibility || 'public') === 'public') {
      const { data: feedPost, error: postError } = await supabaseAdmin
        .from('social_posts')
        .insert({
          user_id: appUser.id,
          rank_id: rank.id,
          post_type: 'rank_share',
          content: rank.title || '',
          visibility: 'public',
          media_title: rank.title || '',
          media_type: 'rank'
        })
        .select('id')
        .single();
      if (postError) {
        console.error('FEED POST FAILED - code:', postError.code, 'msg:', postError.message, 'details:', postError.details, 'hint:', postError.hint);
      } else {
        console.log('Feed post created for rank:', rank.id, 'social_post_id:', feedPost?.id);
      }
    }

    return successResponse(rank);

  } catch (error) {
    console.error('Create rank error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
