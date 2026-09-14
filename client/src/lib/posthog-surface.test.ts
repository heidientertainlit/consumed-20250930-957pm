import assert from 'node:assert/strict';
import test from 'node:test';
import type { CaptureResult } from 'posthog-js';
import {
  createSurfaceLabelHook,
  getAppSurfaceLabels,
  marketingSurfaceLabels,
  withSurfaceLabels,
} from './posthog-surface';

const event = (name = '$pageview'): CaptureResult => ({
  event: name,
  uuid: 'surface-test-event',
  timestamp: new Date(0),
  properties: { distinct_id: 'test-only', kept: true },
});

test('browser detection does not mistake iOS browser OS for native Capacitor', () => {
  assert.deepEqual(getAppSurfaceLabels({
    isNativePlatform: () => false,
    getPlatform: () => 'ios',
  }), { surface: 'web_app', platform: 'web' });
});

test('native iOS receives the exact approved labels', () => {
  assert.deepEqual(getAppSurfaceLabels({
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
  }), { surface: 'ios_app', platform: 'ios' });
});

test('unclassified native platforms are not guessed', () => {
  assert.equal(getAppSurfaceLabels({
    isNativePlatform: () => true,
    getPlatform: () => 'android',
  }), null);
});

for (const name of ['$pageview', 'media_added', '$autocapture', '$snapshot', '$identify']) {
  test(`${name}: labels overwrite conflicting properties without touching the input`, () => {
    const input = event(name);
    input.properties.surface = 'incorrect';
    input.properties.platform = 'incorrect';
    const output = withSurfaceLabels(input, marketingSurfaceLabels)!;
    assert.deepEqual(output.properties, {
      distinct_id: 'test-only', kept: true, surface: 'marketing_site', platform: 'web',
    });
    assert.equal(output.uuid, input.uuid);
    assert.equal(output.timestamp, input.timestamp);
    assert.equal(input.properties.surface, 'incorrect');
  });
}

test('consent remains dynamic and dropped events stay dropped', () => {
  let allowed = false;
  const hook = createSurfaceLabelHook(marketingSurfaceLabels, (input) => allowed ? input : null);
  assert.equal(hook(event()), null);
  allowed = true;
  assert.equal(hook(event())?.properties.surface, 'marketing_site');
  allowed = false;
  assert.equal(hook(event()), null);
});

test('privacy hook output is preserved, without restoring removed fields', () => {
  const input = event();
  input.properties.private_value = 'remove-me';
  const hook = createSurfaceLabelHook(marketingSurfaceLabels, (captured) => {
    const { private_value: _, ...properties } = captured.properties;
    return { ...captured, properties };
  });
  assert.equal(hook(input)?.properties.private_value, undefined);
  assert.equal(hook(input)?.properties.surface, 'marketing_site');
});

test('hook arrays stop on null and never reach subsequent hooks', () => {
  const hook = createSurfaceLabelHook(marketingSurfaceLabels, [
    () => null,
    () => { throw new Error('must not run'); },
  ]);
  assert.equal(hook(event()), null);
  assert.equal(withSurfaceLabels(null, marketingSurfaceLabels), null);
});