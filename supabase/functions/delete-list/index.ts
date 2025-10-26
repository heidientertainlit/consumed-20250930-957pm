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

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get request body
    const { list_id } = await req.json();

    // Validate input
    if (!list_id) {
      return new Response(JSON.stringify({
        error: 'List ID is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if the list exists and belongs to the user
    const { data: list, error: fetchError } = await supabase
      .from('lists')
      .select('id, title, user_id, is_default')
      .eq('id', list_id)
      .single();

    if (fetchError || !list) {
      return new Response(JSON.stringify({
        error: 'List not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CRITICAL SAFETY CHECK: Prevent deletion of system/default lists
    if (list.is_default === true) {
      return new Response(JSON.stringify({
        error: 'Cannot delete system lists (Currently, Queue, Finished, Did Not Finish, Favorites). Only custom lists can be deleted.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user owns the list
    if (list.user_id !== user.id) {
      return new Response(JSON.stringify({
        error: 'You do not have permission to delete this list'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete the list (CASCADE will automatically handle list_items and list_collaborators deletion)
    const { error: deleteError } = await supabase
      .from('lists')
      .delete()
      .eq('id', list_id);

    if (deleteError) {
      console.error('Error deleting list:', deleteError);
      return new Response(JSON.stringify({
        error: 'Failed to delete list: ' + deleteError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Successfully deleted custom list:', list.title);

    return new Response(JSON.stringify({
      success: true,
      message: `List "${list.title}" deleted successfully`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error: ' + error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
