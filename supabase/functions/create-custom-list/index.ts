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
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { title } = await req.json();

    if (!title || title.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'List title is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const normalizedTitle = title.trim();
    const allowedSystemLists = new Set([
      'Currently',
      'Want To',
      'Finished',
      'Did Not Finish',
      'Favorites',
    ]);

    if (!allowedSystemLists.has(normalizedTitle)) {
      return new Response(JSON.stringify({
        error: 'Custom lists are no longer supported'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: newList, error: createError } = await supabase
      .from('lists')
      .upsert({
        title: normalizedTitle,
        user_id: user.id,
        is_default: true,
        is_private: false
      }, {
        onConflict: 'user_id,title',
        ignoreDuplicates: false
      })
      .select('id, title, user_id, is_private, is_default')
      .single();

    if (createError) {
      console.error('Error creating list:', createError);
      return new Response(JSON.stringify({
        error: 'Failed to create list: ' + createError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Created or restored system list:', newList);

    return new Response(JSON.stringify({
      success: true,
      list: newList,
      itemsAdded: 0
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error: ' + (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
