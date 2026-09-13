import { LEGAL_TERMS_VERSION } from "./legal-terms";

export const LEGAL_TERMS_CONSENT_REQUIRED_MESSAGE =
  "Please review and agree to the Terms of Service before continuing.";

export type OAuthConsentAttemptLike = {
  provider: "apple" | "google";
  termsVersion: string;
  issuedAt: number;
};

const DEFAULT_ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;

export function isCurrentLegalTermsVersion(version: unknown): version is string {
  return version === LEGAL_TERMS_VERSION;
}

export function isFreshOAuthConsentAttempt(
  attempt: OAuthConsentAttemptLike,
  now = Date.now(),
  maxAgeMs = DEFAULT_ATTEMPT_MAX_AGE_MS,
) {
  const age = now - attempt.issuedAt;
  return (
    isCurrentLegalTermsVersion(attempt.termsVersion)
    && Number.isFinite(attempt.issuedAt)
    && age >= 0
    && age <= maxAgeMs
  );
}

export function matchesOAuthConsentAttempt({
  attempt,
  userId,
  authSignInUserId,
  provider,
  now = Date.now(),
}: {
  attempt: OAuthConsentAttemptLike;
  userId: string;
  authSignInUserId: string | null;
  provider: "apple" | "google";
  now?: number;
}) {
  return (
    userId.length > 0
    && authSignInUserId === userId
    && attempt.provider === provider
    && isFreshOAuthConsentAttempt(attempt, now)
  );
}

type AcceptanceRpcResult = {
  error: Error | null;
  data?: unknown;
};

/**
 * Keeps the UI checkbox requirement adjacent to the durable write.  Callers
 * cannot accidentally issue the acceptance RPC when consent is false.
 */
export async function saveLegalTermsAcceptance({
  checked,
  rpc,
  version = LEGAL_TERMS_VERSION,
}: {
  checked: boolean;
  rpc: (version: string) => Promise<AcceptanceRpcResult>;
  version?: string;
}): Promise<AcceptanceRpcResult> {
  if (checked !== true) {
    return { error: new Error(LEGAL_TERMS_CONSENT_REQUIRED_MESSAGE) };
  }
  if (!isCurrentLegalTermsVersion(version)) {
    return { error: new Error("The requested terms version is not current.") };
  }

  try {
    return await rpc(version);
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("The terms acceptance request failed."),
    };
  }
}