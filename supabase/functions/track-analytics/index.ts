import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isUuid,
  loadLiveUser,
} from "../_shared/provider-ingestion-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-analytics-key'
};

const POSTHOG_HOST = 'https://us.i.posthog.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const analyticsSecret = Deno.env.get('ANALYTICS_WEBHOOK_SECRET') || '';
    const incomingSecret = req.headers.get('x-analytics-key') || '';
    // This function is a database-webhook ingress, not a public client
    // capture endpoint.  A missing secret is fail-closed rather than silently
    // making the endpoint public.
    if (!analyticsSecret || incomingSecret !== analyticsSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const posthogKey = Deno.env.get('POSTHOG_API_KEY');
    if (!posthogKey) {
      console.error('POSTHOG_API_KEY not set in edge function secrets');
      return new Response(JSON.stringify({ error: 'PostHog not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { event, distinct_id, user_id, properties = {}, timestamp } = body;

    if (typeof event !== 'string' || !event.trim()) {
      return new Response(JSON.stringify({ error: 'event name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (
      distinct_id != null &&
      user_id != null &&
      distinct_id !== user_id
    ) {
      return new Response(JSON.stringify({ error: 'conflicting account identifiers' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accountId = distinct_id || user_id || null;
    if (accountId !== null && !isUuid(accountId)) {
      return new Response(JSON.stringify({ error: 'invalid account identifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isoTimestamp = timestamp
      ? (typeof timestamp === 'number'
          ? new Date(timestamp * 1000).toISOString()
          : timestamp)
      : new Date().toISOString();

    const incomingProperties =
      properties && typeof properties === 'object' && !Array.isArray(properties)
        ? properties as Record<string, unknown>
        : {};
    // The event identity is controlled by the validated webhook envelope.
    // Never allow an arbitrary nested property to override it.
    const {
      distinct_id: _nestedDistinctId,
      user_id: _nestedUserId,
      ...safeProperties
    } = incomingProperties;

    // Check the exact public.users row immediately before the provider send.
    // Anonymous database events remain supported, but any UUID-linked event
    // fails closed if its account is deleted or the lookup is unavailable.
    if (accountId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      if (!supabaseUrl || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Account status unavailable' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const live = await loadLiveUser(admin, accountId, 'id');
      if (!live.allowed) {
        return new Response(JSON.stringify({
          error: live.reason === 'account_lookup_failed'
            ? 'Account status unavailable'
            : 'Account not found',
        }), {
          status: live.reason === 'account_lookup_failed' ? 503 : 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: posthogKey,
        event: event.trim(),
        properties: {
          ...safeProperties,
          distinct_id: accountId || 'anonymous',
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
