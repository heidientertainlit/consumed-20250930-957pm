import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import {
  acceptCurrentLegalTerms,
  isCurrentLegalTermsAcceptance,
  loadCurrentLegalTermsAcceptance,
  hasLocallyAcceptedLegalTerms,
  isLegalTermsAcceptanceInFlight,
  takeMatchingOAuthTermsConsentAttempt,
  subscribeToLegalTermsConsentChanges,
} from "@/lib/legal-terms-consent";
import { LEGAL_TERMS_VERSION } from "@/lib/legal-terms";
import { TermsContent } from "@/components/terms-content";

type ConsentCheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id: string;
  className?: string;
};

/**
 * Shared pre-auth consent control.  The checkbox is deliberately unchecked
 * for every auth surface and the legal text opens in-app rather than leaving
 * the current auth attempt.
 */
export function TermsConsentCheckbox({
  checked,
  onCheckedChange,
  id,
  className = "",
}: ConsentCheckboxProps) {
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <>
      <div className={`flex items-start gap-2 text-left ${className}`}>
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-describedby={`${id}-description`}
          data-testid={id}
        />
        <label
          htmlFor={id}
          id={`${id}-description`}
          className="cursor-pointer text-xs leading-5 text-gray-600"
        >
          I agree to the{" "}
          <button
            type="button"
            className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setTermsOpen(true);
            }}
          >
            Terms of Service
          </button>{" "}
          and acknowledge the Privacy Policy.
        </label>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="flex h-[90dvh] max-h-[90dvh] max-w-3xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-5">
            <DialogTitle>Terms of Service</DialogTitle>
            <DialogDescription>
              Review the current Terms of Service before continuing.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5" tabIndex={0} role="region" aria-label="Terms of Service text">
            <TermsContent />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LegalGateLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        <p className="mt-4 text-sm text-white">Checking your account agreement...</p>
      </div>
    </div>
  );
}

function LegalGateError({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900 px-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        <h1 className="text-xl font-bold text-gray-900">We couldn&apos;t confirm your agreement</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <p className="mt-3 text-xs text-gray-500">
          You can review the{" "}
          <Link href="/terms" className="text-purple-600 underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          or{" "}
          <Link href="/privacy" className="text-purple-600 underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" onClick={onRetry} className="rounded-full bg-purple-600">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button type="button" variant="outline" onClick={onSignOut} className="rounded-full">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function TermsAcceptancePrompt({
  checked,
  setChecked,
  submitting,
  onAccept,
  onSignOut,
  error,
}: {
  checked: boolean;
  setChecked: (checked: boolean) => void;
  submitting: boolean;
  onAccept: () => void;
  onSignOut: () => void;
  error: string | null;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900 px-4 py-4">
      <div className="flex h-[calc(100dvh-2rem)] min-h-[420px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="shrink-0 border-b px-6 py-5 sm:px-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-purple-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Please review our Terms of Service</h1>
              <p className="mt-1 text-sm text-gray-600">
                To continue using Consumed, confirm the current terms for your account.
              </p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 sm:px-8" tabIndex={0} role="region" aria-label="Terms of Service text">
          <TermsContent />
        </div>
        <div className="shrink-0 border-t bg-gray-50 px-6 py-5 sm:px-8">
          <div className="flex items-start gap-2">
            <Checkbox
              id="account-terms-acceptance"
              checked={checked}
              onCheckedChange={(value) => setChecked(value === true)}
              data-testid="checkbox-account-terms-acceptance"
            />
            <label
              htmlFor="account-terms-acceptance"
              className="cursor-pointer text-sm leading-5 text-gray-700"
            >
              I agree to the Terms of Service and acknowledge the Privacy Policy.
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onClick={onAccept}
              disabled={!checked || submitting}
              className="rounded-full bg-purple-600"
              data-testid="button-accept-account-terms"
            >
              {submitting ? "Saving agreement..." : "Agree and continue"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSignOut}
              disabled={submitting}
              className="rounded-full"
              data-testid="button-signout-account-terms"
            >
              Sign out
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Current terms version: {LEGAL_TERMS_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}

function isLegalRoute(pathname: string) {
  return pathname === "/terms" || pathname === "/privacy" || pathname === "/reset-password";
}

/**
 * This gate is above the router's private route elements.  It checks the
 * server-owned row before rendering any authenticated app page, including
 * pages that happen to be guest-accessible when logged out.
 */
export function TermsAcceptanceGate({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [acceptedUserId, setAcceptedUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorUserId, setErrorUserId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => subscribeToLegalTermsConsentChanges(() => {
    setRetryKey((key) => key + 1);
  }), []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setErrorUserId(null);
    setChecked(false);
    setSubmitting(false);
    setResolvedUserId(null);
    setAcceptedUserId(null);

    if (authLoading || !user || !session?.access_token || isLegalRoute(location)) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (isLegalTermsAcceptanceInFlight()) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    void (async () => {
      try {
        if (hasLocallyAcceptedLegalTerms(user.id)) {
          if (!cancelled) {
            setAcceptedUserId(user.id);
            setResolvedUserId(user.id);
            setLoading(false);
          }
          return;
        }
        const pendingOAuthConsent = takeMatchingOAuthTermsConsentAttempt(user);
        if (pendingOAuthConsent) {
          const { error: acceptanceError } = await acceptCurrentLegalTerms(user.id);
          if (acceptanceError) throw acceptanceError;
          if (!cancelled) {
            setAcceptedUserId(user.id);
            setResolvedUserId(user.id);
            setLoading(false);
          }
          return;
        }

        const { data, error: acceptanceError } = await loadCurrentLegalTermsAcceptance();
        if (acceptanceError) throw acceptanceError;
        if (!cancelled) {
          setAcceptedUserId(isCurrentLegalTermsAcceptance(data) ? user.id : null);
          setResolvedUserId(user.id);
          setLoading(false);
        }
      } catch (acceptanceError) {
        console.error("[terms acceptance]", acceptanceError);
        if (!cancelled) {
          setErrorUserId(user.id);
          setResolvedUserId(user.id);
          setError(
            "We couldn't verify your Terms of Service agreement. Check your connection and try again.",
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, location, retryKey, session?.access_token, user]);

  const handleSignOut = async () => {
    const { error: signOutError } = await signOut();
    if (signOutError) {
      setError(`Sign out failed: ${signOutError.message || "Please try again."}`);
    }
  };

  if (authLoading || loading) return <LegalGateLoading />;
  if (isLegalRoute(location) || !user) return <>{children}</>;
  if (resolvedUserId !== user.id) return <LegalGateLoading />;
  if (error && errorUserId === user.id) {
    return (
      <LegalGateError
        message={error}
        onRetry={() => setRetryKey((key) => key + 1)}
        onSignOut={() => void handleSignOut()}
      />
    );
  }
  if (acceptedUserId === user.id) return <>{children}</>;

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    const { error: acceptanceError } = await acceptCurrentLegalTerms(user.id);
    if (acceptanceError) {
      setError(
        acceptanceError.message || "We couldn't save your agreement. Please try again.",
      );
      setSubmitting(false);
      return;
    }
    setAcceptedUserId(user.id);
    setSubmitting(false);
  };

  return (
    <TermsAcceptancePrompt
      checked={checked}
      setChecked={setChecked}
      submitting={submitting}
      onAccept={() => void handleAccept()}
      onSignOut={() => void handleSignOut()}
      error={error}
    />
  );
}