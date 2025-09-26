
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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.email.split('@')[0] || 'user'
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

    if (req.method === 'GET') {
      // Get user's highlights
      const { data: highlights, error: highlightsError } = await supabase
        .from('user_highlights')
        .select('*')
        .eq('user_id', appUser.id)
        .order('created_at', { ascending: false });

      if (highlightsError) {
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch highlights: ' + highlightsError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ highlights: highlights || [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Add new highlight
      const requestBody = await req.json();
      const { title, creator, media_type, image_url, description, external_id, external_source } = requestBody;

      // Check if user already has 3 highlights
      const { data: existingHighlights, error: countError } = await supabase
        .from('user_highlights')
        .select('id')
        .eq('user_id', appUser.id);

      if (countError) {
        return new Response(JSON.stringify({ 
          error: 'Failed to check existing highlights: ' + countError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (existingHighlights && existingHighlights.length >= 3) {
        return new Response(JSON.stringify({ 
          error: 'Maximum of 3 highlights allowed. Remove one to add another.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert new highlight
      const { data: newHighlight, error: insertError } = await supabase
        .from('user_highlights')
        .insert({
          user_id: appUser.id,
          title: title || 'Untitled',
          creator: creator || '',
          media_type: media_type || 'mixed',
          image_url: image_url || null,
          description: description || null,
          external_id: external_id || null,
          external_source: external_source || null
        })
        .select()
        .single();

      if (insertError) {
        return new Response(JSON.stringify({
          error: 'Failed to add highlight: ' + insertError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        highlight: newHighlight
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'DELETE') {
      // Remove highlight
      const { searchParams } = new URL(req.url);
      const highlightId = searchParams.get('id');

      if (!highlightId) {
        return new Response(JSON.stringify({ error: 'Highlight ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error: deleteError } = await supabase
        .from('user_highlights')
        .delete()
        .eq('id', highlightId)
        .eq('user_id', appUser.id); // Ensure user owns the highlight

      if (deleteError) {
        return new Response(JSON.stringify({
          error: 'Failed to remove highlight: ' + deleteError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Highlight removed successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('User highlights error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
