function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export const NATIVE_OAUTH_CALLBACK_PATH = "/auth/callback";
export const NATIVE_OAUTH_CALLBACK_SCHEME = "com.entertainlit.consumed";
export const NATIVE_OAUTH_CALLBACK_URL = `${NATIVE_OAUTH_CALLBACK_SCHEME}://auth/callback`;
const LEGACY_NATIVE_OAUTH_CALLBACK_PATH = "/login";

/**
 * Supabase returns the provider authorization URL when redirect handling is
 * disabled. Only hand that URL to the native browser when it is the expected
 * HTTPS Supabase authorize endpoint.
 */
export function isTrustedNativeOAuthAuthorizationUrl(
  authorizationUrl: string,
  supabaseUrl: string,
  provider: "apple" | "google",
  redirectTo: string,
) {
  const authorization = parseUrl(authorizationUrl);
  const expectedSupabase = parseUrl(supabaseUrl);
  if (!authorization || !expectedSupabase) return false;

  const basePath = expectedSupabase.pathname.replace(/\/$/, "");
  return (
    authorization.protocol === "https:"
    && authorization.origin === expectedSupabase.origin
    && authorization.pathname === `${basePath}/auth/v1/authorize`
    && authorization.searchParams.get("provider") === provider
    && authorization.searchParams.get("redirect_to") === redirectTo
  );
}

export type NativeAuthCallback =
  | {
    kind: "oauth-session";
    accessToken: string;
    refreshToken: string;
    attemptId: string;
  }
  | { kind: "recovery-session"; accessToken: string; refreshToken: string }
  | { kind: "oauth-error"; attemptId: string }
  | null;

export function parseNativeAuthCallback(
  callbackUrl: string,
  appUrl: string,
  hasMatchingOAuthAttempt: (attemptId: string) => boolean,
): NativeAuthCallback {
  const callback = parseUrl(callbackUrl);
  const expectedApp = parseUrl(appUrl);
  if (
    !callback
    || !expectedApp
  ) return null;

  const hashParams = new URLSearchParams(callback.hash.slice(1));
  const getParameter = (name: string) =>
    hashParams.get(name) ?? callback.searchParams.get(name);
  const type = getParameter("type");
  const accessToken = getParameter("access_token");
  const refreshToken = getParameter("refresh_token");
  const attemptId = callback.searchParams.get("oauth_attempt");
  const isOAuthType = type === null || type === "signup";
  const isNativeSchemeOAuthCallback = (
    callback.protocol === `${NATIVE_OAUTH_CALLBACK_SCHEME}:`
    && callback.hostname === "auth"
    && callback.pathname === "/callback"
  );
  const isLegacyHttpsOAuthCallback = (
    callback.protocol === "https:"
    && callback.origin === expectedApp.origin
    && (
      callback.pathname === NATIVE_OAUTH_CALLBACK_PATH
      || callback.pathname === LEGACY_NATIVE_OAUTH_CALLBACK_PATH
    )
  );
  const isOAuthCallbackPath = isNativeSchemeOAuthCallback || isLegacyHttpsOAuthCallback;

  if (
    isOAuthCallbackPath
    && isOAuthType
    && typeof attemptId === "string"
    && hasMatchingOAuthAttempt(attemptId)
    && Boolean(getParameter("error"))
  ) return { kind: "oauth-error", attemptId };

  if (
    isOAuthCallbackPath
    && isOAuthType
    && typeof attemptId === "string"
    && hasMatchingOAuthAttempt(attemptId)
    && accessToken
    && refreshToken
  ) {
    return { kind: "oauth-session", accessToken, refreshToken, attemptId };
  }
  if (
    callback.protocol === "https:"
    && callback.origin === expectedApp.origin
    && callback.pathname === "/reset-password"
    && type === "recovery"
    && accessToken
    && refreshToken
  ) return { kind: "recovery-session", accessToken, refreshToken };

  return null;
}
