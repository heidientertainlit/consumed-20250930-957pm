import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;
let captureAllowed = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;
  
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    // Do not let a stale local PostHog identity send while the authenticated
    // UUID is checked against the current first-party account row.
    opt_out_capturing_by_default: true,
    before_send: (event) => captureAllowed ? event : null,
  });
  
  initialized = true;
  // Explicitly override any previous opt-in persisted by an older app
  // session. The current session must pass the live-account check again.
  posthog.opt_out_capturing();
}

/**
 * The browser SDK uses a public project key and therefore cannot enforce
 * deletion on its own. Keep it opted out until AuthProvider has checked the
 * exact current public.users row. This is a stop-gap for app-owned calls;
 * direct calls to PostHog outside this app still require an ingest proxy.
 */
export function setPostHogCaptureAllowed(allowed: boolean) {
  captureAllowed = allowed;
  if (!initialized) return;

  if (allowed) {
    // Never merge a persisted/deleted UUID into the newly authorized account.
    posthog.reset();
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

export function identifyUser(userId: string, properties: Record<string, any> = {}) {
  if (!initialized || !captureAllowed) return;

  const email = properties?.email as string | undefined;

  const is_internal =
    (!!email &&
      (
        email.startsWith('thinkhp+') ||
        email.endsWith('@consumedapp.com')
      )) ||
    window.location.hostname.includes('localhost');

  posthog.identify(userId, {
    ...properties,
    email,
    is_internal,
  });
}

export function resetUser() {
  if (!initialized) return;
  captureAllowed = false;
  posthog.opt_out_capturing();
  posthog.reset();
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!initialized || !captureAllowed) return;
  posthog.capture(eventName, properties);
}

export function trackPageView(pageName: string, properties?: Record<string, any>) {
  if (!initialized || !captureAllowed) return;
  posthog.capture('$pageview', { page: pageName, ...properties });
}

export { posthog };
