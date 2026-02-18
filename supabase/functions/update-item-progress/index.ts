import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const body = await req.json();
    const { item_id, progress, progress_mode } = body;
    const total = body.progress_total ?? body.total;

    if (!item_id) {
      throw new Error('item_id is required');
    }

    if (progress === undefined || progress === null) {
      throw new Error('progress is required');
    }

    const validModes = ['percent', 'page', 'episode', 'track'];
    if (progress_mode && !validModes.includes(progress_mode)) {
      throw new Error(`Invalid progress_mode. Must be one of: ${validModes.join(', ')}`);
    }

    if (progress_mode === 'percent') {
      if (progress < 0 || progress > 100) {
        throw new Error('Progress must be between 0-100 for percent mode');
      }
    } else {
      if (!Number.isInteger(progress) || progress < 0) {
        throw new Error('Progress must be a positive integer for page/episode/track mode');
      }
    }

    const updateData: any = { progress };
    if (total !== undefined && total !== null) {
      updateData.total = total;
    }
    if (progress_mode !== undefined && progress_mode !== null) {
      updateData.progress_mode = progress_mode;
    }

    const { data, error } = await supabaseClient
      .from('list_items')
      .update(updateData)
      .eq('id', item_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating progress:', error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Update progress error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
