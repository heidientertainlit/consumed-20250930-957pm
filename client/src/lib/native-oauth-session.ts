import type { NativeAuthCallback } from "./native-oauth";

type NativeSessionCallback = Exclude<NativeAuthCallback, null | { kind: "oauth-error" }>;

/**
 * Runs the shared, post-browser session handoff. Callers close the verified
 * browser before this function; an OAuth handoff failure always releases only
 * the exact initiating consent attempt.
 */
export async function restoreNativeAuthCallbackSession(
  callback: NativeSessionCallback,
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{
    error: unknown | null;
  }>,
  onOAuthFailure: (attemptId: string) => void,
) {
  try {
    const { error } = await setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    });
    if (!error) return true;
  } catch {
    // Treat a thrown handoff exactly like an explicit SDK error.
  }

  if (callback.kind === "oauth-session") {
    onOAuthFailure(callback.attemptId);
  }
  return false;
}