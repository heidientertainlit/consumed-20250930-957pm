import assert from 'node:assert/strict';
import test from 'node:test';
import { resetPostHogPreservingReplayPolicy } from './posthog-replay-lifecycle';

const key = '$session_recording_remote_config';

test('reset clears identity and session state, preserving only unchanged project policy', () => {
  const policy = { enabled: true, cache_timestamp: 123, sampleRate: 0.2, masking: { maskAllInputs: true } };
  let state: Record<string, unknown> = {
    [key]: policy, distinct_id: 'old-account', $sesid: 'old-session',
    $session_recording_is_sampled: true,
  };
  const calls: string[] = [];
  resetPostHogPreservingReplayPolicy({
    get_property(name) { calls.push('read'); return state[name]; },
    reset() { calls.push('reset'); state = {}; },
    register(properties) { calls.push('register'); Object.assign(state, properties); },
  });
  assert.deepEqual(calls, ['read', 'reset', 'register']);
  assert.deepEqual(state, { [key]: policy });
  assert.equal(state[key], policy);
  assert.equal(policy.cache_timestamp, 123);
});

test('disabled project policy stays disabled', () => {
  const policy = { enabled: false, cache_timestamp: 123 };
  const restored: unknown[] = [];
  resetPostHogPreservingReplayPolicy({
    get_property: () => policy,
    reset() {},
    register(properties) { restored.push(properties); },
  });
  assert.deepEqual(restored, [{ [key]: policy }]);
});

test('absent or malformed policy is never manufactured into an enabled policy', () => {
  for (const policy of [undefined, null, false, true, 'invalid', []]) {
    let resets = 0;
    resetPostHogPreservingReplayPolicy({
      get_property: () => policy,
      reset() { resets += 1; },
      register() { assert.fail('must not restore missing/malformed policy'); },
    });
    assert.equal(resets, 1);
  }
});