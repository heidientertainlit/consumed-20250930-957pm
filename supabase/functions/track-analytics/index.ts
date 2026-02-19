import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-analytics-key'
};

const POSTHOG_HOST = 'https://us.i.posthog.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const posthogKey = Deno.env.get('POSTHOG_API_KEY');
    if (!posthogKey) {
      console.error('POSTHOG_API_KEY not set in edge function secrets');
      return new Response(JSON.stringify({ error: 'PostHog not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const analyticsSecret = Deno.env.get('ANALYTICS_WEBHOOK_SECRET') || '';
    const incomingSecret = req.headers.get('x-analytics-key') || '';
    if (analyticsSecret && incomingSecret !== analyticsSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { event, distinct_id, user_id, properties = {}, timestamp } = body;

    if (!event) {
      return new Response(JSON.stringify({ error: 'event name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isoTimestamp = timestamp
      ? (typeof timestamp === 'number'
          ? new Date(timestamp * 1000).toISOString()
          : timestamp)
      : new Date().toISOString();

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: posthogKey,
        event,
        properties: {
          distinct_id: distinct_id || user_id || 'anonymous',
          ...properties,
          $lib: 'supabase-trigger',
        },
        timestamp: isoTimestamp,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PostHog capture error:', errorText);
      return new Response(JSON.stringify({ error: 'PostHog capture failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Event "${event}" sent for user ${distinct_id || user_id || 'anonymous'}`);
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
