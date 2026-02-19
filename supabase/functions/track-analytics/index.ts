import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const POSTHOG_HOST = 'https://us.i.posthog.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const posthogKey = Deno.env.get('POSTHOG_API_KEY');
    if (!posthogKey) {
      console.error('POSTHOG_API_KEY not set');
      return new Response(JSON.stringify({ error: 'PostHog not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();

    if (body.type === 'batch') {
      const events = body.events || [];
      if (events.length === 0) {
        return new Response(JSON.stringify({ success: true, processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const batch = events.map((evt: any) => ({
        event: evt.event,
        properties: {
          distinct_id: evt.distinct_id || evt.user_id || 'anonymous',
          ...evt.properties,
          $lib: 'supabase-edge',
        },
        timestamp: evt.timestamp || new Date().toISOString(),
      }));

      const response = await fetch(`${POSTHOG_HOST}/batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: posthogKey,
          batch,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PostHog batch error:', errorText);
        return new Response(JSON.stringify({ error: 'PostHog batch failed', details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Sent ${batch.length} events to PostHog`);
      return new Response(JSON.stringify({ success: true, processed: batch.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { event, distinct_id, user_id, properties = {}, timestamp } = body;

    if (!event) {
      return new Response(JSON.stringify({ error: 'event name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: posthogKey,
        event,
        properties: {
          distinct_id: distinct_id || user_id || 'anonymous',
          ...properties,
          $lib: 'supabase-edge',
        },
        timestamp: timestamp || new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PostHog capture error:', errorText);
      return new Response(JSON.stringify({ error: 'PostHog capture failed', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Event "${event}" sent to PostHog for user ${distinct_id || user_id || 'anonymous'}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('track-analytics error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
