import posthog from 'posthog-js';
import { supabase } from './supabase';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createSurfaceLabelHook, getAppSurfaceLabels } from './posthog-surface';
import {
  canReuseGuestToken,
  guestTokenExpiry,
  isCaptureContextCurrent,
  type CaptureContext,
} from './posthog-authorization';

// This is intentionally not a PostHog project token.  The SDK needs a token
// to initialize on the controlled path.  The rollout flag is deliberately
// default-off: until the Edge path has been provisioned and reviewed, the
// existing public legacy token keeps analytics flowing.  The replacement
// server capture token is never a Vite variable.
const GATEWAY_PUBLIC_PLACEHOLDER = 'consumed-posthog-gateway-v1';
const legacyPostHogKey = import.meta.env.VITE_POSTHOG_KEY || '';
const controlledIngestionEnabled =
  import.meta.env.VITE_POSTHOG_CONTROLLED_INGESTION === 'true';
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const POSTHOG_GATEWAY = controlledIngestionEnabled && supabaseUrl
  ? `${supabaseUrl}/functions/v1/posthog-capture`
  : '';
const LEGACY_POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;
let captureAllowed = false;
let guestSessionToken: string | null = null;
let guestSessionExpiresAt = 0;
let guestSessionPromise: Promise<boolean> | null = null;
let gatewayHeaders: Record<string, string> = {};
let pageLeaveSent = false;
let authGeneration = 0;
let expectedAuthUuid: string | null = null;

function updateExpectedAuthUuid(nextUuid: string | null, invalidate = true) {
  if (expectedAuthUuid === nextUuid) {
    if (invalidate) authGeneration += 1;
    return;
  }
  expectedAuthUuid = nextUuid;
  authGeneration += 1;
}

function currentContext(context: CaptureContext) {
  return isCaptureContextCurrent(context, {
    generation: authGeneration,
    expectedUuid: expectedAuthUuid,
    captureAllowed,
  });
}

function clearGuestSession() {
  guestSessionToken = null;
  guestSessionExpiresAt = 0;
  guestSessionPromise = null;
  gatewayHeaders = {};
  if (initialized) posthog.set_config({ request_headers: {} });
}

async function requestGuestSession(retries = 1): Promise<boolean> {
  const response = await fetch(`${POSTHOG_GATEWAY}/guest`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (response.status === 401 && retries > 0) {
    clearGuestSession();
    return requestGuestSession(retries - 1);
  }
  if (!response.ok) return false;
  const body = await response.json().catch(() => ({}));
  const token = typeof body?.session_token === 'string'
    ? body.session_token
    : null;
  if (!token) return false;
  guestSessionToken = token;
  guestSessionExpiresAt = guestTokenExpiry(token);
  gatewayHeaders = { 'X-PostHog-Guest-Token': token };
  posthog.set_config({ request_headers: gatewayHeaders });
  return true;
}

function ensureGuestSession(force = false): Promise<boolean> {
  if (!POSTHOG_GATEWAY) return Promise.resolve(false);
  const now = Math.floor(Date.now() / 1000);
  if (
    !force &&
    canReuseGuestToken(guestSessionToken, guestSessionExpiresAt, now)
  ) {
    return Promise.resolve(true);
  }
  if (guestSessionPromise) return guestSessionPromise;

  guestSessionPromise = requestGuestSession()
    .catch(() => false)
    .then((success) => {
      // A failed promise must never poison future capture attempts. A valid
      // token is cached until its signed expiry, then renewed on demand.
      guestSessionPromise = null;
      if (!success) clearGuestSession();
      return success;
    });
  return guestSessionPromise;
}

async function refreshGatewayAuthorization(
  expectedUuid?: string | null,
): Promise<CaptureContext | null> {
  const generation = authGeneration;
  const expected = expectedUuid === undefined ? expectedAuthUuid : expectedUuid;
  const hasExplicitAuthenticatedExpectation =
    typeof expectedUuid === 'string' && expectedUuid.length > 0;
  if (!controlledIngestionEnabled) {
    return { generation, expectedUuid: expected, mode: 'legacy' };
  }
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (
      generation !== authGeneration ||
      (expectedAuthUuid && expected !== expectedAuthUuid)
    ) return null;
    if (session?.access_token) {
      // An anonymous/signed-out caller must never adopt a stale session that
      // arrived after its auth transition. Only identifyUser's explicit,
      // verified expected UUID may establish a not-yet-observed session.
      if (!expectedAuthUuid && !hasExplicitAuthenticatedExpectation) return null;
      if (!session.user?.id || (expected && session.user.id !== expected)) return null;
      // A verified session is allowed to establish the expected UUID when
      // identifyUser raced the auth-state callback. The UUID is never sent as
      // provider identity; it only binds this async callback to that session.
      if (!expectedAuthUuid) expectedAuthUuid = session.user.id;
      gatewayHeaders = { Authorization: `Bearer ${session.access_token}` };
      posthog.set_config({ request_headers: gatewayHeaders });
      return { generation, expectedUuid: session.user.id, mode: 'authenticated' };
    }

    if (expected) return null;
    gatewayHeaders = guestSessionToken
      ? { 'X-PostHog-Guest-Token': guestSessionToken }
      : {};
    posthog.set_config({ request_headers: gatewayHeaders });
    if (!(await ensureGuestSession())) return null;
    if (generation !== authGeneration || expected !== expectedAuthUuid) return null;
    return { generation, expectedUuid: null, mode: 'guest' };
  } catch {
    gatewayHeaders = {};
    posthog.set_config({ request_headers: {} });
    return null;
  }
}

async function sendControlledCapture(
  context: CaptureContext,
  envelope: Record<string, unknown>,
): Promise<boolean> {
  const send = async () => fetch(POSTHOG_GATEWAY, {
    method: 'POST',
    credentials: 'include',
    headers: { ...gatewayHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  let response = await send();
  if (response.status === 401 && currentContext(context)) {
    // Retry exactly once. Authenticated requests can only refresh to another
    // authenticated session; they never downgrade to a guest request.
    if (context.mode === 'guest') {
      if (!(await ensureGuestSession(true))) return false;
      response = await send();
    } else if (context.mode === 'authenticated') {
      const refreshed = await refreshGatewayAuthorization(context.expectedUuid);
      if (!refreshed || refreshed.mode !== 'authenticated') return false;
      response = await send();
    }
  }
  // The request may have crossed an auth transition while the browser was
  // waiting for it. Do not let the caller treat that completion as belonging
  // to the newer identity.
  return response.ok && currentContext(context);
}

async function capturePageLeave() {
  if (
    !controlledIngestionEnabled ||
    !initialized ||
    !captureAllowed ||
    pageLeaveSent ||
    !POSTHOG_GATEWAY
  ) return;
  pageLeaveSent = true;

  let headers = gatewayHeaders;
  if (!Object.keys(headers).length) {
    if (!(await refreshGatewayAuthorization())) return;
    headers = gatewayHeaders;
  }

  const properties = {
    $current_url: typeof window !== 'undefined' ? window.location.href : '',
    $title: typeof document !== 'undefined' ? document.title : '',
  };
  try {
    // Do not use sendBeacon: it cannot carry the verified Supabase bearer or
    // guest-session header. keepalive fetch preserves those auth bindings.
    let response = await fetch(POSTHOG_GATEWAY, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: '$pageleave', properties }),
    });
    if (response.status === 401) {
      if (expectedAuthUuid === null) await ensureGuestSession(true);
      const refreshed = await refreshGatewayAuthorization();
      if (!refreshed) return;
      response = await fetch(POSTHOG_GATEWAY, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { ...gatewayHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: '$pageleave', properties }),
      });
    }
  } catch {
    // Page lifecycle requests are best effort; the gateway remains fail-closed.
  }
}

function installPageLeaveTracking() {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void capturePageLeave();
      else pageLeaveSent = false;
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void capturePageLeave());
  }
  try {
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) pageLeaveSent = false;
      else void capturePageLeave();
    }).catch(() => undefined);
  } catch {
    // The web implementation may not expose a native app-state bridge.
  }
}

export function initPostHog() {
  if (initialized) return;
  if (controlledIngestionEnabled && !POSTHOG_GATEWAY) return;
  if (!controlledIngestionEnabled && !legacyPostHogKey) return;
  
  posthog.init(controlledIngestionEnabled ? GATEWAY_PUBLIC_PLACEHOLDER : legacyPostHogKey, {
    api_host: controlledIngestionEnabled ? POSTHOG_GATEWAY : LEGACY_POSTHOG_HOST,
    api_transport: 'fetch',
    // The controlled gateway accepts one event per request. Legacy mode keeps
    // the existing SDK batching/pageleave behavior until rollout is enabled.
    request_batching: controlledIngestionEnabled ? false : true,
    disable_compression: controlledIngestionEnabled,
    capture_pageview: false,
    capture_pageleave: !controlledIngestionEnabled,
    save_campaign_params: false,
    capture_performance: { web_vitals_attribution: false },
    autocapture: true,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    // Do not let a stale local PostHog identity send while the authenticated
    // UUID is checked against the current first-party account row.
    opt_out_capturing_by_default: true,
    before_send: createSurfaceLabelHook(
      getAppSurfaceLabels(Capacitor),
      (event) => captureAllowed ? event : null,
    ),
  });
  
  initialized = true;
  // Explicitly override any previous opt-in persisted by an older app
  // session. The current session must pass the live-account check again.
  posthog.opt_out_capturing();
  if (controlledIngestionEnabled) {
    void ensureGuestSession();
    installPageLeaveTracking();
  }
  // Keep SDK autocapture headers current across Supabase token refreshes.
  // Wrapped events also call refreshGatewayAuthorization immediately before
  // capture; this listener covers SDK-generated autocapture/pageleave events.
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!initialized) return;
    updateExpectedAuthUuid(session?.user?.id ?? null);
    if (session?.access_token) {
      gatewayHeaders = { Authorization: `Bearer ${session.access_token}` };
      posthog.set_config({ request_headers: gatewayHeaders });
    } else {
      gatewayHeaders = guestSessionToken
        ? { 'X-PostHog-Guest-Token': guestSessionToken }
        : {};
      posthog.set_config({ request_headers: gatewayHeaders });
      if (captureAllowed) void ensureGuestSession();
    }
  });
}

/**
 * Keep the gateway-backed SDK opted out until AuthProvider has checked the
 * exact current public.users row. Direct calls to PostHog outside this app
 * remain outside this gateway's control.
 */
export function setPostHogCaptureAllowed(
  allowed: boolean,
  expectedUuid?: string | null,
) {
  if (expectedUuid !== undefined) {
    updateExpectedAuthUuid(expectedUuid);
  } else if (!allowed) {
    authGeneration += 1;
  }
  captureAllowed = allowed;
  if (!initialized) return;

  if (allowed) {
    // Never merge a persisted/deleted UUID into the newly authorized account.
    posthog.reset();
    void refreshGatewayAuthorization().then((authorized) => {
      if (!authorized || !currentContext(authorized)) return;
      posthog.opt_in_capturing();
    });
  } else {
    posthog.opt_out_capturing();
    gatewayHeaders = {};
    posthog.set_config({ request_headers: {} });
  }
}

export function identifyUser(_userId: string, properties: Record<string, any> = {}) {
  if (!initialized || !captureAllowed) return;

  const expectedUuid = _userId;
  void refreshGatewayAuthorization(expectedUuid).then((authorized) => {
    if (!authorized || !currentContext(authorized)) return;
    const email = properties?.email as string | undefined;
    const is_internal =
      (!!email &&
        (email.startsWith('thinkhp+') || email.endsWith('@consumedapp.com'))) ||
      (typeof window !== 'undefined' && window.location.hostname.includes('localhost'));
    const envelope = {
      event: '$identify',
      properties: { is_internal },
      $set: { ...properties, is_internal },
    };
    if (controlledIngestionEnabled) {
      void sendControlledCapture(authorized, envelope);
    } else {
      // Rollout-off intentionally preserves the existing legacy SDK
      // semantics. Controlled mode never reaches this branch and therefore
      // never permits this caller-provided UUID to select provider identity.
      posthog.identify(expectedUuid, envelope.$set);
    }
  });
}

export function resetUser() {
  if (!initialized) return;
  authGeneration += 1;
  captureAllowed = false;
  posthog.opt_out_capturing();
  gatewayHeaders = {};
  posthog.set_config({ request_headers: {} });
  posthog.reset();
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!initialized || !captureAllowed) return;
  void refreshGatewayAuthorization().then((authorized) => {
    if (!authorized || !currentContext(authorized)) return;
    if (controlledIngestionEnabled) {
      void sendControlledCapture(authorized, { event: eventName, properties: properties || {} });
    } else {
      posthog.capture(eventName, properties);
    }
  });
}

export function trackPageView(pageName: string, properties?: Record<string, any>) {
  if (!initialized || !captureAllowed) return;
  void refreshGatewayAuthorization().then((authorized) => {
    if (authorized && currentContext(authorized)) {
      if (controlledIngestionEnabled) {
        void sendControlledCapture(authorized, {
          event: '$pageview',
          properties: { page: pageName, ...properties },
        });
        return;
      }
      posthog.capture('$pageview', { page: pageName, ...properties });
    }
  });
}

export { posthog };
