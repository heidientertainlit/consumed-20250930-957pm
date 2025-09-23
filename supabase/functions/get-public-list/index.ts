import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("get-public-list function hit!", req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role key to access all data
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get URL parameters
    const url = new URL(req.url);
    const listSlug = url.searchParams.get('list_slug'); // e.g., "currently"
    const userId = url.searchParams.get('user_id');

    console.log("Public list request:", { listSlug, userId });

    if (!listSlug) {
      return new Response(JSON.stringify({ error: 'list_slug parameter is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Convert slug to title
    const slugToTitle = {
      'currently': 'Currently',
      'queue': 'Queue', 
      'finished': 'Finished',
      'did-not-finish': 'Did Not Finish'
    };
    
    const listTitle = slugToTitle[listSlug as keyof typeof slugToTitle];
    if (!listTitle) {
      return new Response(JSON.stringify({ error: 'Invalid list slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If userId provided, get that user's public list
    if (userId) {
      console.log(`Fetching public list "${listTitle}" for user ${userId}`);
      
      // Check if user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, user_name, email')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error("User not found:", userError);
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get the specific list for this user
      const { data: list, error: listError } = await supabase
        .from('lists')
        .select('id, title, is_private, user_id')
        .eq('title', listTitle)
        .eq('user_id', userId)
        .single();

      if (listError || !list) {
        console.error("List not found:", listError);
        return new Response(JSON.stringify({ error: 'List not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // All lists are now public for MVP - removed privacy check

      // Get list items
      const { data: items, error: itemsError } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', list.id)
        .order('created_at', { ascending: false });

      if (itemsError) {
        console.error("Failed to fetch list items:", itemsError);
        return new Response(JSON.stringify({ error: 'Failed to fetch list items' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Found public list with ${items?.length || 0} items`);

      return new Response(JSON.stringify({
        list: {
          ...list,
          items: items || [],
          owner: user.user_name || user.email.split('@')[0]
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // No userId provided, return system default list (empty)
      console.log(`Returning system default list: ${listTitle}`);
      
      return new Response(JSON.stringify({
        list: {
          id: listSlug,
          title: listTitle,
          is_private: false,
          items: [],
          owner: 'System'
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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