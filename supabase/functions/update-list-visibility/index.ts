import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("update-list-visibility function hit!", req.method, req.url);
  
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
    console.log("Auth check result:", { user: user?.email, userError });
    
    if (!user || userError) {
      console.error("Authentication failed:", userError);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { listId, isPublic } = await req.json();
    console.log("Updating list visibility:", { listId, isPublic });

    if (!listId) {
      return new Response(JSON.stringify({ error: 'listId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update the list privacy setting
    const { data, error } = await supabase
      .from('lists')
      .update({ 
        is_private: !isPublic, // is_private is opposite of isPublic
        updated_at: new Date().toISOString()
      })
      .eq('id', listId)
      .eq('user_id', user.id) // Ensure user owns the list
      .select()
      .single();

    if (error) {
      console.error("Failed to update list visibility:", error);
      return new Response(JSON.stringify({ error: 'Failed to update list visibility' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("List visibility updated successfully:", data);
    
    return new Response(JSON.stringify({ 
      success: true, 
      list: data,
      message: `List is now ${isPublic ? 'public' : 'private'}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});