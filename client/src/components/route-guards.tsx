import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  loadProfileIdentity,
  type ResolvedProfileIdentity,
} from "@/lib/profile-identity-resolver";
import {
  isOnboardingComplete,
  markOnboardingComplete,
  loadOnboardingProgress,
  saveOnboardingProgress,
  dismissOnboardingPrompt,
  isOnboardingPromptDismissed,
  resetOnboardingState,
  resolveOnboardingResumeStep,
  type OnboardingResumeStep,
  type OnboardingProgress,
} from "@/lib/onboarding-progress";

export {
  isOnboardingComplete,
  markOnboardingComplete,
  loadOnboardingProgress,
  saveOnboardingProgress,
  dismissOnboardingPrompt,
  isOnboardingPromptDismissed,
  resetOnboardingState,
  resolveOnboardingResumeStep,
};
export type { OnboardingResumeStep, OnboardingProgress };

interface RouteGuardProps {
  children: React.ReactNode;
}

function IdentityLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-white text-sm mt-4">{label}</div>
      </div>
    </div>
  );
}

function IdentityLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h1 className="text-xl font-bold text-gray-900">We couldn't load your profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          Please try again. We won't send you through setup until we can verify your profile.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 w-full rounded-full bg-purple-600 py-3 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function useResolvedIdentity(skip = false) {
  const { user, session, loading } = useAuth();
  const [identity, setIdentity] = useState<ResolvedProfileIdentity | null>(null);
  const [identityError, setIdentityError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (loading || !user || !session?.access_token || skip) {
      setIdentity(null);
      setIdentityError(false);
      return;
    }

    setIdentity(null);
    setIdentityError(false);
    void loadProfileIdentity(user, session.access_token, { force: retryKey > 0 })
      .then((result) => {
        if (!cancelled) setIdentity(result);
      })
      .catch((error) => {
        console.error("[identity route guard]", error);
        if (!cancelled) setIdentityError(true);
      });
    return () => { cancelled = true; };
  }, [loading, retryKey, session?.access_token, skip, user]);

  return {
    user,
    loading,
    identity,
    identityError,
    retryIdentity: () => setRetryKey((key) => key + 1),
  };
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const [location, setLocation] = useLocation();
  const onOnboarding = location.startsWith("/onboarding");
  const { user, loading, identity, identityError, retryIdentity } = useResolvedIdentity(onOnboarding);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      if (fullPath !== "/login") sessionStorage.setItem("returnUrl", fullPath);
      setLocation("/login");
      return;
    }
    if (!onOnboarding && identity && !identity.complete) {
      sessionStorage.setItem(
        "identityReturnUrl",
        window.location.pathname + window.location.search + window.location.hash,
      );
      setLocation("/onboarding");
    }
  }, [identity, loading, onOnboarding, setLocation, user]);

  if (loading || (!onOnboarding && user && !identity && !identityError)) {
    return <IdentityLoading />;
  }
  if (identityError) return <IdentityLoadError onRetry={retryIdentity} />;

  if (!user) {
    return null;
  }

  if (!onOnboarding && !identity?.complete) return <IdentityLoading />;
  return <>{children}</>;
}

export function IdentityAwareRoute({ children }: RouteGuardProps) {
  const [, setLocation] = useLocation();
  const { user, loading, identity, identityError, retryIdentity } = useResolvedIdentity();

  useEffect(() => {
    if (!loading && user && identity && !identity.complete) {
      sessionStorage.setItem(
        "identityReturnUrl",
        window.location.pathname + window.location.search + window.location.hash,
      );
      setLocation("/onboarding");
    }
  }, [identity, loading, setLocation, user]);

  if (loading || (user && !identity && !identityError)) return <IdentityLoading />;
  if (identityError) return <IdentityLoadError onRetry={retryIdentity} />;
  if (user && !identity?.complete) return <IdentityLoading />;
  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: RouteGuardProps) {
  const [, setLocation] = useLocation();
  const { user, loading, identity, identityError, retryIdentity } = useResolvedIdentity();
  const [redirectError, setRedirectError] = useState(false);

  useEffect(() => {
    if (loading || !user || !identity) return;
    let cancelled = false;

    const redirectAuthenticatedUser = async () => {
      const returnUrl = sessionStorage.getItem("returnUrl");
      const isLeaderboardShareReturn = Boolean(
        returnUrl
        && returnUrl.startsWith("/leaderboard?")
        && new URLSearchParams(returnUrl.split("?")[1] || "").has("share"),
      );
      const dnaResult = await supabase
        .from("dna_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (dnaResult.error) {
        setRedirectError(true);
        return;
      }

      const dnaProfile = dnaResult.data;
      if (dnaProfile) markOnboardingComplete(user.id);

      if (!identity.complete) {
        if (isLeaderboardShareReturn && returnUrl) {
          sessionStorage.setItem("identityReturnUrl", returnUrl);
        }
        sessionStorage.removeItem("returnUrl");
        setLocation("/onboarding");
        return;
      }

      // A normal returning-user sign-in always starts on Now. Stale protected
      // routes (for example /dna from a previous session) must not override the
      // post-login landing page. Incomplete profiles are routed to onboarding
      // above before reaching this branch.
      sessionStorage.removeItem("returnUrl");
      setLocation(isLeaderboardShareReturn && returnUrl ? returnUrl : "/activity");
    };

    void redirectAuthenticatedUser();
    return () => { cancelled = true; };
  }, [identity, loading, setLocation, user]);

  if (identityError || redirectError) {
    return <IdentityLoadError onRetry={() => {
      setRedirectError(false);
      retryIdentity();
    }} />;
  }
  if (loading || user) return <IdentityLoading label={loading ? "Loading..." : "Redirecting..."} />;

  return <>{children}</>;
}
