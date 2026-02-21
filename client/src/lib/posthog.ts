import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;
  
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
  });
  
  initialized = true;
}

export function identifyUser(userId: string, properties: Record<string, any> = {}) {
  if (!initialized) return;

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
  posthog.reset();
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!initialized) return;
  posthog.capture(eventName, properties);
}

export function trackPageView(pageName: string, properties?: Record<string, any>) {
  if (!initialized) return;
  posthog.capture('$pageview', { page: pageName, ...properties });
}

export { posthog };
