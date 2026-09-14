import type { BeforeSendFn, CaptureResult } from 'posthog-js';

export type SurfaceLabels =
  | { surface: 'marketing_site'; platform: 'web' }
  | { surface: 'web_app'; platform: 'web' }
  | { surface: 'ios_app'; platform: 'ios' };

export const marketingSurfaceLabels: SurfaceLabels = {
  surface: 'marketing_site',
  platform: 'web',
};

type NativePlatform = {
  isNativePlatform(): boolean;
  getPlatform(): string;
};

export function getAppSurfaceLabels(platform: NativePlatform): SurfaceLabels | null {
  if (!platform.isNativePlatform()) {
    return { surface: 'web_app', platform: 'web' };
  }
  if (platform.getPlatform() === 'ios') {
    return { surface: 'ios_app', platform: 'ios' };
  }
  // Do not mislabel an unsupported native platform as a browser or iOS.
  return null;
}

export function withSurfaceLabels(
  event: CaptureResult | null,
  labels: SurfaceLabels | null,
): CaptureResult | null {
  if (!event || !labels) return event;
  return {
    ...event,
    properties: { ...event.properties, ...labels },
  };
}

/**
 * Run existing consent/privacy hooks first. Never revive a dropped event.
 * Labels live in this hook, not persistence, so SDK reset cannot clear them.
 */
export function createSurfaceLabelHook(
  labels: SurfaceLabels | null,
  previous?: BeforeSendFn | BeforeSendFn[],
): BeforeSendFn {
  const hooks = previous ? (Array.isArray(previous) ? previous : [previous]) : [];
  return (event) => {
    let result: CaptureResult | null = event;
    for (const hook of hooks) {
      result = hook(result);
      if (!result) return null;
    }
    return withSurfaceLabels(result, labels);
  };
}