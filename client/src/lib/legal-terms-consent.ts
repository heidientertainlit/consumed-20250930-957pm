import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LEGAL_TERMS_VERSION } from "@/lib/legal-terms";
import {
  matchesOAuthConsentAttempt,
  saveLegalTermsAcceptance,
  isFreshOAuthConsentAttempt,
} from "@/lib/legal-terms-flow";
export {
  isCurrentLegalTermsVersion,
  isFreshOAuthConsentAttempt,
  matchesOAuthConsentAttempt,
  saveLegalTermsAcceptance,
} from "@/lib/legal-terms-flow";

const PENDING_OAUTH_CONSENT_KEY = "consumed.pending-legal-terms-consent";
const PENDING_ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;
let locallyAcceptedUserId: string | null = null;
let legalTermsAcceptanceInFlight = false;
let lastAuthSignInUserId: string | null = null;
const LEGAL_TERMS_CONSENT_EVENT = "consumed:legal-terms-consent";

export type OAuthConsentAttempt = {
  id: string;
  provider: "apple" | "google";
  termsVersion: string;
  issuedAt: number;
};

function getStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function createAttemptId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function beginOAuthTermsConsentAttempt(
  provider: OAuthConsentAttempt["provider"],
): OAuthConsentAttempt {
  const attempt: OAuthConsentAttempt = {
    id: createAttemptId(),
    provider,
    termsVersion: LEGAL_TERMS_VERSION,
    issuedAt: Date.now(),
  };
  getStorage()?.setItem(PENDING_OAUTH_CONSENT_KEY, JSON.stringify(attempt));
  return attempt;
}

export function clearOAuthTermsConsentAttempt() {
  getStorage()?.removeItem(PENDING_OAUTH_CONSENT_KEY);
}

function readOAuthTermsConsentAttempt(): OAuthConsentAttempt | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(PENDING_OAUTH_CONSENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OAuthConsentAttempt>;
    if (
      typeof parsed.id !== "string"
      || (parsed.provider !== "apple" && parsed.provider !== "google")
      || typeof parsed.termsVersion !== "string"
      || typeof parsed.issuedAt !== "number"
      || !isFreshOAuthConsentAttempt(
        {
          provider: parsed.provider,
          termsVersion: parsed.termsVersion,
          issuedAt: parsed.issuedAt,
        },
        Date.now(),
        PENDING_ATTEMPT_MAX_AGE_MS,
      )
    ) {
      clearOAuthTermsConsentAttempt();
      return null;
    }
    return parsed as OAuthConsentAttempt;
  } catch {
    clearOAuthTermsConsentAttempt();
    return null;
  }
}

function userUsedProvider(user: User, provider: OAuthConsentAttempt["provider"]) {
  const appProvider = user.app_metadata?.provider;
  if (appProvider === provider) return true;
  return (user.identities ?? []).some((identity) => identity.provider === provider);
}

/**
 * A pre-auth checkbox is intentionally represented by a one-use, short-lived
 * session-storage attempt.  It is consumed only after a matching OAuth
 * callback, never persisted as account metadata, and is cleared on every
 * alternate auth attempt/sign-out.
 */
export function takeMatchingOAuthTermsConsentAttempt(user: User) {
  const attempt = readOAuthTermsConsentAttempt();
  if (
    !attempt
    || !matchesOAuthConsentAttempt({
      attempt,
      userId: user.id,
      authSignInUserId: lastAuthSignInUserId,
      provider: attempt.provider,
      now: Date.now(),
    })
    || !userUsedProvider(user, attempt.provider)
  ) {
    return false;
  }
  clearOAuthTermsConsentAttempt();
  lastAuthSignInUserId = null;
  return true;
}

export function noteAuthSignIn(userId: string) {
  lastAuthSignInUserId = userId;
}

export function clearAuthSignInNote() {
  lastAuthSignInUserId = null;
}

export async function acceptCurrentLegalTerms(userId?: string, checked = true) {
  const result = await saveLegalTermsAcceptance({
    checked,
    version: LEGAL_TERMS_VERSION,
    rpc: async (version) => supabase.rpc("accept_current_terms", {
      p_terms_version: version,
    }),
  });
  if (!result.error && userId) locallyAcceptedUserId = userId;
  return result;
}

/**
 * This is only a same-page race guard after the server RPC succeeds.  It is
 * not persisted and is never used as a substitute for the acceptance query
 * on a new session or account.
 */
export function hasLocallyAcceptedLegalTerms(userId: string) {
  return locallyAcceptedUserId === userId;
}

export function clearLocallyAcceptedLegalTerms() {
  locallyAcceptedUserId = null;
}

export function beginLegalTermsAcceptanceAttempt() {
  legalTermsAcceptanceInFlight = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LEGAL_TERMS_CONSENT_EVENT));
  }
}

export function finishLegalTermsAcceptanceAttempt() {
  legalTermsAcceptanceInFlight = false;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LEGAL_TERMS_CONSENT_EVENT));
  }
}

export function isLegalTermsAcceptanceInFlight() {
  return legalTermsAcceptanceInFlight;
}

export function subscribeToLegalTermsConsentChanges(listener: () => void) {
  window.addEventListener(LEGAL_TERMS_CONSENT_EVENT, listener);
  return () => window.removeEventListener(LEGAL_TERMS_CONSENT_EVENT, listener);
}

export async function loadCurrentLegalTermsAcceptance() {
  return supabase
    .from("account_terms_acceptances")
    .select("terms_version, accepted_at")
    .maybeSingle();
}

export function isCurrentLegalTermsAcceptance(
  acceptance: { terms_version?: string | null } | null | undefined,
) {
  return acceptance?.terms_version === LEGAL_TERMS_VERSION;
}