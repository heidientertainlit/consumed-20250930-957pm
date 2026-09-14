import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadLiveUser,
} from "../_shared/provider-ingestion-guard.ts";
import {
  containsEmailProperty,
  isIdentityTransitionEvent,
  parseCaptureEnvelope,
  stripEmailProperties,
} from "../_shared/posthog-capture-policy.ts";

const allowedOrigins = [
  'https://app.consumedapp.com',
  'https://www.consumedapp.com',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  ...(Deno.env.get('REPLIT_DEV_DOMAIN')
    ? [`https://${Deno.env.get('REPLIT_DEV_DOMAIN')}`]
    : []),
  ...(Deno.env.get('POSTHOG_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
].map((origin) => origin.replace(/\/+$/, ""));
const corsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin');
  return {
    ...(origin && allowedOrigins.includes(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        }
      : {}),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-analytics-key',
  };
};

const POSTHOG_HOST = Deno.env.get('POSTHOG_CAPTURE_HOST') || 'https://us.i.posthog.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders(req),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
    });
  }

  try {
    const analyticsSecret = Deno.env.get('ANALYTICS_WEBHOOK_SECRET') || '';
    const incomingSecret = req.headers.get('x-analytics-key') || '';
    const authorization = req.headers.get('Authorization') || '';
    const isTrustedProducer = !!analyticsSecret && incomingSecret === analyticsSecret;
    // This function is a database-webhook ingress, not a public client
    // capture endpoint.  A missing secret is fail-closed rather than silently
    // making the endpoint public.  Browser callers use a Supabase bearer
    // session; they never receive ANALYTICS_WEBHOOK_SECRET.
    if (!isTrustedProducer && !/^Bearer\s+\S+$/i.test(authorization)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    // The replacement token is primary and both names are server-only.
    // POSTHOG_API_KEY remains an explicit legacy fallback until staged
    // rotation is confirmed; remove that fallback after cutover.
    const posthogKey =
      Deno.env.get('POSTHOG_CAPTURE_TOKEN') ||
      Deno.env.get('POSTHOG_API_KEY');
    if (!posthogKey) {
      console.error('PostHog capture token not set in edge function secrets');
      return new Response(JSON.stringify({ error: 'PostHog not configured' }), {
        status: 500,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const parsed = parseCaptureEnvelope(body, {
      allowUserId: isTrustedProducer,
      // A previously deployed database trigger used top-level distinct_id.
      // Accept it only on the Vault-authenticated producer path while this
      // function is rolled out; bearer/browser callers remain fail-closed.
      allowLegacyDistinctId: isTrustedProducer,
    });
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    if (
      isIdentityTransitionEvent(parsed.envelope.event) &&
      parsed.envelope.event !== '$identify'
    ) {
      return new Response(JSON.stringify({ error: 'Identity transition is not allowed' }), {
        status: 403,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Account status unavailable' }), {
        status: 503,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let accountId: string | undefined =
      parsed.envelope.user_id || parsed.envelope.legacy_distinct_id;
    let authenticatedEmail: string | null = null;
    if (!isTrustedProducer) {
      const token = authorization.replace(/^Bearer\s+/i, '').trim();
      const {
        data: { user },
        error: authError,
      } = await admin.auth.getUser(token);
      if (authError || !user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
        });
      }
      // The authenticated subject is authoritative.  Ignore any attempted
      // body identity rather than allowing a client-selected UUID.
      accountId = user.id;
      // Email is resolved only from the live public.users row below.
      authenticatedEmail = null;
    }

    if (!accountId) {
      return new Response(JSON.stringify({ error: 'server user identity required' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    // Check the exact public.users row and immutable deletion tombstone before
    // every provider send.  A missing/erroring tombstone lookup is fail-closed.
    const live = await loadLiveUser(admin, accountId, 'id,email');
    if (!live.allowed) {
      return new Response(JSON.stringify({
        error: live.reason === 'account_lookup_failed'
          ? 'Account status unavailable'
          : 'Account not found',
      }), {
        status: live.reason === 'account_lookup_failed' ? 503 : 404,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    const { data: tombstone, error: tombstoneError } = await admin
      .from('deleted_account_tombstones')
      .select('user_id')
      .eq('user_id', accountId)
      .maybeSingle();
    if (tombstoneError) {
      return new Response(JSON.stringify({ error: 'Account status unavailable' }), {
        status: 503,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    if (tombstone?.user_id === accountId) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    if (!isTrustedProducer) {
      authenticatedEmail = live.user.email || null;
    }

    let providerProperties = parsed.envelope.properties;
    let providerSet = parsed.envelope.set;
    let providerSetOnce = parsed.envelope.set_once;
    if (!isTrustedProducer) {
      const inputForEmailCheck = {
        properties: parsed.envelope.properties,
        set: parsed.envelope.set,
        set_once: parsed.envelope.set_once,
      };
      const hadClientEmail = containsEmailProperty(inputForEmailCheck);
      providerProperties = stripEmailProperties(providerProperties);
      providerSet = providerSet
        ? stripEmailProperties(providerSet)
        : undefined;
      providerSetOnce = providerSetOnce
        ? stripEmailProperties(providerSetOnce)
        : undefined;
      if (hadClientEmail && authenticatedEmail) {
        providerProperties.email = authenticatedEmail;
        if (parsed.envelope.event === '$identify') {
          providerSet = {
            ...(providerSet || {}),
            email: authenticatedEmail,
          };
        }
      }
    }

    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: posthogKey,
        event: parsed.envelope.event,
        properties: {
          ...providerProperties,
          distinct_id: accountId,
          $lib: 'supabase-trigger',
        },
        ...(providerSet ? { $set: providerSet } : {}),
        ...(providerSetOnce ? { $set_once: providerSetOnce } : {}),
        ...(parsed.envelope.timestamp
          ? { timestamp: parsed.envelope.timestamp }
          : {}),
      }),
    });

    if (!response.ok) {
      await response.text().catch(() => undefined);
      console.error('PostHog capture failed with status:', response.status);
      return new Response(JSON.stringify({ error: 'PostHog capture failed' }), {
        status: 500,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
    });

  } catch {
    console.error('track-analytics request failed');
    return new Response(JSON.stringify({ error: 'Analytics request failed' }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' }
    });
  }
});
