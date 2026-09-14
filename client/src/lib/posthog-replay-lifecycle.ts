const RECORDING_POLICY_KEY = '$session_recording_remote_config';

type ResettableSdk = {
  get_property(key: string): unknown;
  reset(): void;
  register(properties: Record<string, unknown>): void;
};

/**
 * posthog-js 1.352.0 normally re-persists project recording policy on a new
 * session, but opt-out removes that listener before reset. Preserve only
 * that existing policy using public APIs, never identity/session state.
 *
 * Keep enabled, masking, sampling rules and cache_timestamp unchanged.
 * The SDK still enforces policy expiry; absent/disabled policy stays so.
 * Re-verify the persisted policy key with real-recorder tests on SDK upgrades.
 */
export function resetPostHogPreservingReplayPolicy(sdk: ResettableSdk): void {
  const policy = sdk.get_property(RECORDING_POLICY_KEY);
  sdk.reset();
  if (policy && typeof policy === 'object' && !Array.isArray(policy)) {
    sdk.register({ [RECORDING_POLICY_KEY]: policy });
  }
}