import posthog from 'posthog-js';
import {
  createReplayPrototypeAdapter,
  isReplayPrototypeEnabled,
  type ReplayPrototypeAdapter,
  type ReplayPrototypeLeaseProvider,
  type ReplayPrototypeSdk,
} from './posthog-replay-prototype';

/**
 * Isolated opt-in harness. It is deliberately not imported by main.tsx or the
 * legacy posthog.ts adapter, so a normal application build retains the exact
 * existing SDK path unless a reviewer wires this harness into a disposable
 * prototype entry point.
 */
export function initializeReplayPrototypeHarness(
  leaseProvider: ReplayPrototypeLeaseProvider,
  environment: Record<string, string | undefined> | undefined = import.meta.env,
): ReplayPrototypeAdapter | null {
  if (!isReplayPrototypeEnabled(environment)) return null;

  // The factory deliberately exposes only the public methods common to the
  // two inspected SDK versions; it does not depend on PostHog internals.
  const adapter = createReplayPrototypeAdapter(
    posthog as unknown as ReplayPrototypeSdk,
    leaseProvider,
  );
  adapter.initialize();
  return adapter;
}