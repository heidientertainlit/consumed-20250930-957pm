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
    const clientEventId = body.client_event_id ?? body.event_id ?? body.idempotency_key ?? null;

    if (!item_id) {
      throw new Error('item_id is required');
    }

    if (progress === undefined || progress === null) {
      throw new Error('progress is required');
    }
    if (!Number.isInteger(progress)) {
      throw new Error('progress must be an integer');
    }
    if (total !== undefined && total !== null && (!Number.isInteger(total) || total < 0)) {
      throw new Error('total must be a non-negative integer');
    }
    if (clientEventId !== null &&
      (typeof clientEventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientEventId))) {
      throw new Error('client_event_id must be a UUID');
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

    const { data, error } = await supabaseClient
      .rpc('record_list_item_progress', {
        p_item_id: item_id,
        p_progress: progress,
        p_total: total ?? null,
        p_progress_mode: progress_mode ?? null,
        p_client_event_id: clientEventId,
      });

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
