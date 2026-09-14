/**
 * Pure authorization state helpers shared by the browser capture wrapper and
 * its deferred-transition tests. No Supabase, SDK, or browser imports belong
 * here: a callback is valid only while this exact generation and expected
 * first-party subject remain current.
 */
export type CaptureContext = {
  generation: number;
  expectedUuid: string | null;
  mode: 'authenticated' | 'guest' | 'legacy';
};

export type CaptureAuthorizationState = {
  generation: number;
  expectedUuid: string | null;
  captureAllowed: boolean;
};

export function isCaptureContextCurrent(
  context: CaptureContext,
  state: CaptureAuthorizationState,
): boolean {
  return (
    context.generation === state.generation &&
    context.expectedUuid === state.expectedUuid &&
    state.captureAllowed
  );
}

export function guestTokenExpiry(token: string): number {
  const expiry = Number(token.split('.')[2]);
  return Number.isFinite(expiry) ? expiry : 0;
}

export function canReuseGuestToken(
  token: string | null,
  expiresAt: number,
  nowSeconds: number,
): boolean {
  return !!token && expiresAt > nowSeconds + 60;
}